const mongoose = require('mongoose');
const config = require('./src/config');
const connectDB = require('./src/config/db');
const app = require('./src/app');
const jobs = require('./src/jobs');
const { getSettings } = require('./src/services/settings.service');

async function main() {
  try {
    await connectDB();
  } catch (err) {
    console.error('\n[db] Could not connect to MongoDB at', config.mongoUri);
    console.error('     Start MongoDB (e.g. `docker compose up -d`) or set MONGODB_URI in server/.env to your Atlas URL.\n');
    process.exit(1);
  }
  await getSettings(); // ensure the settings document exists
  const server = app.listen(config.port, () => {
    console.log(`[api] TechOf Solution Tracker API running on http://localhost:${config.port}/api`);
  });
  if (!process.env.VERCEL) jobs.start();

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();