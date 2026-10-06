// Append-only guards: history can be added to, never silently rewritten or removed.
function guard(schema, { blockUpdate = false, protectedPaths = [], blockDelete = true } = {}) {
  if (blockDelete) {
    schema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function (next) {
      next(new Error('This record is part of the permanent history and cannot be deleted.'));
    });
    schema.pre('deleteOne', { document: true, query: false }, function (next) {
      next(new Error('This record is part of the permanent history and cannot be deleted.'));
    });
  }
  schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace'], function (next) {
    if (blockUpdate) return next(new Error('This record is append-only and cannot be modified.'));
    const u = this.getUpdate() || {};
    if (Array.isArray(u)) return next();
    const keys = [
      ...Object.keys(u.$set || {}), ...Object.keys(u.$unset || {}), ...Object.keys(u.$inc || {}),
      ...Object.keys(u).filter((k) => !k.startsWith('$')),
    ];
    if (keys.some((k) => protectedPaths.includes(k))) {
      return next(new Error('Protected history fields cannot be modified.'));
    }
    next();
  });
}
module.exports = guard;
