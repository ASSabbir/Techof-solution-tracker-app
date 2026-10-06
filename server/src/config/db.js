const mongoose = require('mongoose');
const config = require('./index');

mongoose.set('strictQuery', true);
// Fail fast with a clear error instead of silently buffering queries for 10s when there is no connection.
mongoose.set('bufferCommands', false);

// Cached across invocations: serverless platforms (Vercel) reuse warm instances.
let cached = global.__techofMongo;
if (!cached) cached = global.__techofMongo = { conn: null, promise: null };

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
  return cached.conn;
}

module.exports = connectDB;