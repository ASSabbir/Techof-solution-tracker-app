const ActivityLog = require('../models/ActivityLog');

exports.log = async (userId, action, entityType, entityId, message, metadata = {}) => {
  try {
    return await ActivityLog.create({ userId, action, entityType, entityId, message, metadata });
  } catch (err) {
    console.error('[activity] failed to write log', err.message);
    return null;
  }
};
