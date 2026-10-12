const Meeting = require('../models/Meeting');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { USER_FIELDS } = require('../utils/constants');
const { getSettings } = require('./settings.service');
const { notify } = require('./notification.service');
const activity = require('./activity.service');

const MIN = 60_000;
const RETENTION_MS = 30 * 24 * 3600_000;
const REMINDER_LEVELS = [60, 10]; // minutes before the start
const RESPONSE_TEXT = { GOING: 'is going to', MAYBE: 'might attend', NOT_GOING: 'can’t attend' };

const endOf = (m) => new Date(new Date(m.startsAt).getTime() + (m.durationMinutes || 60) * MIN);
const expiryFor = (m) => new Date(endOf(m).getTime() + RETENTION_MS);

function fmtWhen(date, tz) {
  const d = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  const t = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  return `${d}, ${t}`;
}

const activeUsers = () => User.find({ status: 'ACTIVE' }).select(USER_FIELDS).sort({ name: 1 }).lean();
const idOf = (v) => String(v && v._id ? v._id : v);

/* Shape a meeting for the client: who was invited, who answered what, and what the viewer may do. */
function decorate(m, viewer, users) {
  const obj = m.toObject ? m.toObject() : m;
  const byUser = new Map((obj.rsvps || []).map((r) => [idOf(r.userId), r]));
  const people = users.map((u) => {
    const r = byUser.get(String(u._id));
    return { user: u, response: r ? r.response : 'PENDING', note: r ? r.note : '', respondedAt: r ? r.respondedAt : null };
  });
  const count = (k) => people.filter((p) => p.response === k).length;
  const me = people.find((p) => String(p.user._id) === String(viewer._id));
  const manage = String(idOf(obj.createdBy)) === String(viewer._id) || String(idOf(obj.responsible)) === String(viewer._id);
  const { rsvps, remindersSent, ...rest } = obj;
  return {
    ...rest,
    endsAt: endOf(obj),
    people,
    counts: { going: count('GOING'), maybe: count('MAYBE'), notGoing: count('NOT_GOING'), pending: count('PENDING') },
    myResponse: me ? me.response : 'PENDING',
    canManage: manage,
  };
}

const populate = (q) => q.populate('createdBy', USER_FIELDS).populate('responsible', USER_FIELDS).populate('cancelledBy', USER_FIELDS);

async function list(viewer) {
  const [items, users] = await Promise.all([populate(Meeting.find({}).sort({ startsAt: 1 })), activeUsers()]);
  return items.map((m) => decorate(m, viewer, users));
}

async function getOne(viewer, id) {
  const [m, users] = await Promise.all([populate(Meeting.findById(id)), activeUsers()]);
  if (!m) throw new AppError('Meeting not found.', 404);
  return decorate(m, viewer, users);
}

async function assertResponsible(userId) {
  const u = await User.findOne({ _id: userId, status: 'ACTIVE' }).select('name').lean();
  if (!u) throw new AppError('Choose a teammate as the responsible person.', 400);
  return u;
}

async function create(user, body) {
  const settings = await getSettings();
  const startsAt = new Date(body.startsAt);
  if (startsAt.getTime() < Date.now() - 5 * MIN) throw new AppError('The meeting time is in the past. Pick a future date and time.', 400);
  const responsible = await assertResponsible(body.responsible);

  const organisers = [...new Set([String(user._id), String(body.responsible)])];
  const m = await Meeting.create({
    title: body.title, projectName: body.projectName, companyName: body.companyName, personName: body.personName,
    responsible: body.responsible, createdBy: user._id, startsAt, durationMinutes: body.durationMinutes,
    mode: body.mode, location: body.location, agenda: body.agenda,
    // The organiser and the responsible person are going by default.
    rsvps: organisers.map((id) => ({ userId: id, response: 'GOING' })),
  });
  m.expireAt = expiryFor(m);
  await m.save();

  const when = fmtWhen(startsAt, settings.timezone);
  const summary = `${body.projectName} · ${body.companyName} — ${when}`;
  const everyone = (await activeUsers()).map((u) => u._id);
  const link = `/meetings?open=${m._id}`;
  const respId = String(body.responsible);
  await notify(everyone.filter((id) => String(id) !== respId), {
    type: 'MEETING_ANNOUNCED', title: 'New meeting announced',
    message: `${user.name} announced “${body.title}” (${summary}). ${responsible.name} is responsible. Are you going?`,
    entityType: 'Meeting', entityId: m._id, link,
  }, user._id);
  await notify(respId, {
    type: 'MEETING_RESPONSIBLE', title: 'You’re responsible for a meeting',
    message: `${user.name} made you responsible for “${body.title}” (${summary}).`,
    entityType: 'Meeting', entityId: m._id, link,
  }, user._id);
  await activity.log(user._id, 'MEETING_CREATED', 'Meeting', m._id, `${user.name} announced a meeting: “${body.title}” with ${body.companyName} (${when})`, { project: body.projectName });
  return getOne(user, m._id);
}

const SIGNIFICANT = ['title', 'projectName', 'companyName', 'personName', 'location', 'mode', 'durationMinutes'];

async function update(user, id, patch) {
  const m = await Meeting.findById(id);
  if (!m) throw new AppError('Meeting not found.', 404);
  if (![idOf(m.createdBy), idOf(m.responsible)].includes(String(user._id))) throw new AppError('Only the person who announced the meeting or the responsible person can change it.', 403);
  if (m.status === 'CANCELLED') throw new AppError('This meeting was cancelled.', 409);
  const settings = await getSettings();

  let rescheduled = false;
  let responsibleChanged = false;
  const changed = [];

  if (patch.startsAt !== undefined) {
    const next = new Date(patch.startsAt);
    if (next.getTime() !== m.startsAt.getTime()) {
      if (next.getTime() < Date.now() - 5 * MIN) throw new AppError('The new time is in the past.', 400);
      m.startsAt = next; rescheduled = true; changed.push('time');
    }
  }
  if (patch.responsible !== undefined && String(patch.responsible) !== String(m.responsible)) {
    await assertResponsible(patch.responsible);
    m.responsible = patch.responsible; responsibleChanged = true; changed.push('responsible');
  }
  for (const k of [...SIGNIFICANT, 'agenda']) {
    if (patch[k] !== undefined && patch[k] !== m[k]) { m[k] = patch[k]; if (k !== 'agenda') changed.push(k); }
  }
  const notesOnly = patch.notes !== undefined && patch.notes !== m.notes;
  if (notesOnly) m.notes = patch.notes;

  if (rescheduled) {
    // New time: everyone confirms again. The organiser and the responsible person stay "going".
    const keep = [...new Set([idOf(m.createdBy), idOf(m.responsible)])];
    m.rsvps = keep.map((uid) => ({ userId: uid, response: 'GOING' }));
    m.remindersSent = [];
  }
  m.expireAt = expiryFor(m);
  await m.save();

  const link = `/meetings?open=${m._id}`;
  const everyone = (await activeUsers()).map((u) => u._id);
  if (changed.length) {
    const when = fmtWhen(m.startsAt, settings.timezone);
    await notify(everyone, {
      type: 'MEETING_UPDATED', title: rescheduled ? 'Meeting rescheduled' : 'Meeting details changed',
      message: rescheduled
        ? `“${m.title}” moved to ${when}. Please confirm again — are you going?`
        : `${user.name} updated “${m.title}” (${when}). Open it to see what changed.`,
      entityType: 'Meeting', entityId: m._id, link,
    }, user._id);
  }
  if (responsibleChanged) {
    await notify(String(m.responsible), {
      type: 'MEETING_RESPONSIBLE', title: 'You’re responsible for a meeting',
      message: `${user.name} made you responsible for “${m.title}” (${fmtWhen(m.startsAt, settings.timezone)}).`,
      entityType: 'Meeting', entityId: m._id, link,
    }, user._id);
  }
  if (changed.length || notesOnly) {
    await activity.log(user._id, 'MEETING_UPDATED', 'Meeting', m._id, `${user.name} ${rescheduled ? 'rescheduled' : 'updated'} the meeting “${m.title}”`, { changed: notesOnly ? [...changed, 'notes'] : changed });
  }
  return getOne(user, m._id);
}

async function rsvp(user, id, { response, note }) {
  const m = await Meeting.findById(id);
  if (!m) throw new AppError('Meeting not found.', 404);
  if (m.status === 'CANCELLED') throw new AppError('This meeting was cancelled.', 409);
  if (endOf(m).getTime() < Date.now()) throw new AppError('This meeting is already over.', 409);

  const entry = { userId: user._id, response, note: note || '', respondedAt: new Date() };
  const res = await Meeting.updateOne(
    { _id: m._id, 'rsvps.userId': user._id },
    { $set: { 'rsvps.$.response': response, 'rsvps.$.note': entry.note, 'rsvps.$.respondedAt': entry.respondedAt } }
  );
  if (!res.matchedCount) await Meeting.updateOne({ _id: m._id, 'rsvps.userId': { $ne: user._id } }, { $push: { rsvps: entry } });

  // Tell the organiser and the responsible person.
  const prev = (m.rsvps || []).find((r) => String(r.userId) === String(user._id));
  if (!prev || prev.response !== response) {
    await notify([idOf(m.createdBy), idOf(m.responsible)], {
      type: 'MEETING_RSVP', title: 'Meeting response',
      message: `${user.name} ${RESPONSE_TEXT[response]} “${m.title}”${note ? ` — “${note}”` : ''}.`,
      entityType: 'Meeting', entityId: m._id, link: `/meetings?open=${m._id}`,
    }, user._id);
    await activity.log(user._id, 'MEETING_RSVP', 'Meeting', m._id, `${user.name} ${RESPONSE_TEXT[response]} “${m.title}”`, { response });
  }
  return getOne(user, m._id);
}

async function cancel(user, id, reason = '') {
  const m = await Meeting.findById(id);
  if (!m) throw new AppError('Meeting not found.', 404);
  if (![idOf(m.createdBy), idOf(m.responsible)].includes(String(user._id))) throw new AppError('Only the person who announced the meeting or the responsible person can cancel it.', 403);
  if (m.status === 'CANCELLED') throw new AppError('This meeting is already cancelled.', 409);
  const settings = await getSettings();
  m.status = 'CANCELLED'; m.cancelledAt = new Date(); m.cancelledBy = user._id; m.cancelReason = reason || '';
  await m.save();
  const everyone = (await activeUsers()).map((u) => u._id);
  await notify(everyone, {
    type: 'MEETING_CANCELLED', title: 'Meeting cancelled',
    message: `${user.name} cancelled “${m.title}” (${fmtWhen(m.startsAt, settings.timezone)})${reason ? ` — ${reason}` : ''}.`,
    entityType: 'Meeting', entityId: m._id, link: `/meetings?open=${m._id}`,
  }, user._id);
  await activity.log(user._id, 'MEETING_CANCELLED', 'Meeting', m._id, `${user.name} cancelled the meeting “${m.title}”`, { reason });
  return getOne(user, m._id);
}

/* Reminders: 60 and 10 minutes before the start, to everyone who hasn't said "can't attend". */
let lastRun = 0;
async function processReminders({ force = false } = {}) {
  if (!force && Date.now() - lastRun < 25_000) return 0;
  lastRun = Date.now();
  const now = new Date();
  const horizon = new Date(now.getTime() + Math.max(...REMINDER_LEVELS) * MIN);
  const meetings = await Meeting.find({ status: 'SCHEDULED', startsAt: { $gt: now, $lte: horizon } });
  if (!meetings.length) return 0;
  const users = await activeUsers();
  let sent = 0;
  for (const m of meetings) {
    const remaining = (m.startsAt - now) / MIN;
    const crossed = REMINDER_LEVELS.filter((l) => remaining <= l);
    if (!crossed.length) continue;
    const level = Math.min(...crossed);
    if ((m.remindersSent || []).some((l) => l <= level)) continue;
    const marked = await Meeting.findOneAndUpdate(
      { _id: m._id, remindersSent: { $nin: crossed } },
      { $addToSet: { remindersSent: { $each: REMINDER_LEVELS.filter((l) => l >= level) } } }
    );
    if (!marked) continue;
    sent++;
    const declined = new Set((m.rsvps || []).filter((r) => r.response === 'NOT_GOING').map((r) => String(r.userId)));
    const to = users.filter((u) => !declined.has(String(u._id)) || String(u._id) === idOf(m.responsible)).map((u) => u._id);
    await notify(to, {
      type: 'MEETING_REMINDER', title: level <= 10 ? 'Meeting starting soon' : 'Meeting in about an hour',
      message: `“${m.title}” with ${m.companyName} starts in ${level} minutes${m.location ? ` — ${m.location}` : ''}.`,
      entityType: 'Meeting', entityId: m._id, link: `/meetings?open=${m._id}`,
    });
  }
  return sent;
}

module.exports = { list, getOne, create, update, rsvp, cancel, processReminders };