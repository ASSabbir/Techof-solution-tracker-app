'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { MEETING_MODES, RSVP_META, TONE } from '@/lib/constants';
import { fmtMinutes } from '@/lib/format';
import { useServerNow } from '@/lib/clock';
import { useAction } from '@/hooks/queries';
import { Avatar, Badge, Spinner } from '@/components/ui/primitives';
import Icon from '@/components/ui/Icon';
import { PhaseBadge, RsvpButtons, calendarLink, isUrl, phaseOf, timeRange } from './parts';

function Row({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"><Icon name={icon} className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-muted">{label}</p><div className="text-sm font-bold">{children}</div></div>
    </div>
  );
}

export default function MeetingDetail({ meeting: m, onEdit, onClose }) {
  const now = useServerNow();
  const phase = phaseOf(m, now);
  const [note, setNote] = useState('');
  const [minutes, setMinutes] = useState(m.notes || '');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => { setMinutes(m.notes || ''); }, [m.notes]);

  const rsvp = useAction(({ response }) => api(`/meetings/${m._id}/rsvp`, { method: 'POST', body: { response, note: note.trim() } }), {
    success: (_d, v) => ({ GOING: 'Great — you’re marked as going.', MAYBE: 'Marked as maybe.', NOT_GOING: 'Marked as can’t go.' }[v.response]),
    onSuccess: () => setNote(''),
  });
  const saveNotes = useAction((text) => api(`/meetings/${m._id}`, { method: 'PATCH', body: { notes: text } }), { success: 'Meeting notes saved.' });
  const cancel = useAction(() => api(`/meetings/${m._id}/cancel`, { method: 'POST', body: { reason: reason.trim() } }), {
    success: 'Meeting cancelled. Everyone was notified.', onSuccess: () => { setCancelling(false); setReason(''); },
  });

  const mode = MEETING_MODES.find((x) => x.value === m.mode) || MEETING_MODES[0];
  const canRsvp = phase === 'upcoming' || phase === 'live';
  const when = new Date(m.startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <PhaseBadge m={m} now={now} />
        <Badge tone="muted" icon={mode.icon}>{mode.label}</Badge>
        {m.status === 'CANCELLED' && m.cancelledBy && <span className="text-xs text-muted">by {m.cancelledBy.name}{m.cancelReason ? ` — “${m.cancelReason}”` : ''}</span>}
      </div>

      <div className="grid gap-x-6 divide-y divide-line/70 sm:grid-cols-2 sm:divide-y-0">
        <div className="divide-y divide-line/70">
          <Row icon="project" label="Project">{m.projectName}</Row>
          <Row icon="company" label="Company">{m.companyName}</Row>
          <Row icon="profile" label="Person we’re meeting">{m.personName}</Row>
        </div>
        <div className="divide-y divide-line/70">
          <Row icon="crown" label="Responsible"><span className="flex items-center gap-2"><Avatar user={m.responsible} size="xs" />{m.responsible?.name}</span></Row>
          <Row icon="calendar" label="When">{when}<span className="block font-semibold text-muted">{timeRange(m)} · {fmtMinutes(m.durationMinutes)}</span></Row>
          <Row icon={mode.icon} label={mode.label}>
            {m.location ? (isUrl(m.location) ? <a href={m.location} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">{m.location}</a> : <span className="break-words">{m.location}</span>) : <span className="font-semibold text-muted">Not added yet</span>}
          </Row>
        </div>
      </div>

      {m.agenda && (
        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
          <p className="eyebrow mb-1.5">Agenda</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.agenda}</p>
        </div>
      )}

      {canRsvp && (
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
          <p className="mb-3 text-sm font-extrabold">Will you be there?</p>
          <RsvpButtons value={m.myResponse} busy={rsvp.isPending} onPick={(response) => rsvp.mutate({ response })} />
          <input className="input mt-3" maxLength={200} placeholder="Add a short note (optional) — applied with your next answer" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">Responses</p>
          <p className="text-xs font-semibold text-muted">{m.counts.going} going · {m.counts.maybe} maybe · {m.counts.notGoing} can’t go · {m.counts.pending} waiting</p>
        </div>
        <ul className="divide-y divide-line/70 rounded-xl border border-line">
          {m.people.map((p) => {
            const meta = RSVP_META[p.response];
            return (
              <li key={p.user._id} className="flex items-center gap-3 px-3.5 py-2.5">
                <Avatar user={p.user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.user.name}{String(p.user._id) === String(m.responsible?._id) && <span className="ml-2 text-xs font-semibold text-accent">Responsible</span>}</p>
                  {p.note && <p className="truncate text-xs text-muted">“{p.note}”</p>}
                </div>
                <Badge tone={meta.tone} dot>{meta.label}</Badge>
              </li>
            );
          })}
        </ul>
      </div>

      {(m.notes || (m.canManage && m.status !== 'CANCELLED')) && (
        <div>
          <p className="eyebrow mb-2">Meeting notes</p>
          {m.canManage && m.status !== 'CANCELLED' ? (
            <>
              <textarea className="input min-h-[110px] resize-y" maxLength={3000} placeholder="Decisions, action items, what the client said…" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
              <div className="mt-2.5 flex justify-end">
                <button className="btn-soft btn-sm" disabled={saveNotes.isPending || minutes.trim() === (m.notes || '')} onClick={() => saveNotes.mutate(minutes.trim())}>{saveNotes.isPending ? <><Spinner />Saving…</> : <><Icon name="save" className="h-3.5 w-3.5" />Save notes</>}</button>
              </div>
            </>
          ) : <p className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2/60 p-3.5 text-sm leading-relaxed">{m.notes}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <a href={calendarLink(m)} target="_blank" rel="noopener noreferrer" className={clsx('btn-ghost btn-sm', m.status === 'CANCELLED' && 'invisible')}><Icon name="meetingAdd" className="h-3.5 w-3.5" />Add to calendar</a>
        <div className="flex flex-wrap items-center gap-2.5">
          {m.canManage && m.status !== 'CANCELLED' && phase !== 'done' && !cancelling && (
            <>
              <button className="btn-danger btn-sm" onClick={() => setCancelling(true)}>Cancel meeting</button>
              <button className="btn-soft btn-sm" onClick={() => onEdit(m)}><Icon name="edit" className="h-3.5 w-3.5" />Edit</button>
            </>
          )}
          <button className="btn-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      {cancelling && (
        <div className={clsx('rounded-xl border p-4', TONE.danger.border, TONE.danger.bg)}>
          <p className="text-sm font-bold">Cancel this meeting for everyone?</p>
          <input className="input mt-3" maxLength={300} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-3 flex justify-end gap-2.5">
            <button className="btn-ghost btn-sm" onClick={() => setCancelling(false)} disabled={cancel.isPending}>Keep it</button>
            <button className="btn-danger btn-sm" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? <><Spinner />Cancelling…</> : 'Yes, cancel meeting'}</button>
          </div>
        </div>
      )}
    </div>
  );
}