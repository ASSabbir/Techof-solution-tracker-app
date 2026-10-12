const mongoose = require('mongoose');
const config = require('./index');

mongoose.set('strictQuery', true);
// Fail fast with a clear error instead of silently buffering queries for 10s when there is no connection.
mongoose.set('bufferCommands', false);

// Cached across invocations: serverless platforms (Vercel) reuse warm instances.
let cached = global.__techofMongo;
if (!cached) cached = global.__techofMongo = { conn: null, promise: null, indexed: false };

// Creates the auto-cleanup (TTL) indexes once per process:
//  - activity log entries disappear after 7 days
//  - finished tasks (and their extension records) disappear 30 days after they close
//  - notifications disappear after 14 days
//  - meetings disappear 30 days after they end
async function ensureCleanupIndexes() {
  if (cached.indexed) return;
  cached.indexed = true;
  const names = ['ActivityLog', 'Task', 'TaskExtension', 'Notification', 'Meeting'];
  await Promise.all(names.map(async (n) => {
    const model = require(`../models/${n}`);
    try {
      await model.createIndexes();
    } catch (err) {
      // 85/86 = an older index with the same name but different options (e.g. before it became unique/partial).
      // Drop the stale one and create the new one. Safe: indexes hold no data of their own.
      if ([85, 86].includes(err.code) || /same name/i.test(err.message || '')) {
        try {
          await model.syncIndexes();
          console.log(`[db] rebuilt outdated indexes on ${n}`);
          return;
        } catch (err2) {
          console.error(`[db] could not rebuild indexes on ${n}:`, err2.message);
          return;
        }
      }
      console.error(`[db] could not create indexes on ${n}:`, err.message);
    }
  }));
}

async function connectDB() {
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(config.mongoUri, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 })
      .then((m) => {
        console.log(`[db] connected to ${m.connection.host}/${m.connection.name}`);
        return m;
      })
      .catch((err) => {
        cached.promise = null; // allow a retry on the next request
        throw err;
      });
  }
  cached.conn = await cached.promise;
  await ensureCleanupIndexes();
  return cached.conn;
}

module.exports = connectDB;