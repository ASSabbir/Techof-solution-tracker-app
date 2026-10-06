const Notification = require('../models/Notification');

// recipients: single id or array of ids. The actor can be excluded via `exclude`.
exports.notify = async (recipients, { type, title, message, entityType, entityId, link }, exclude) => {
  const ids = [...new Set((Array.isArray(recipients) ? recipients : [recipients]).filter(Boolean).map(String))].filter(
    (id) => !exclude || String(exclude) !== id
  );
  if (!ids.length) return [];
  try {
    return await Notification.insertMany(ids.map((userId) => ({ userId, type, title, message, entityType, entityId, link })));
  } catch (err) {
    console.error('[notify] failed', err.message);
    return [];
  }
};
