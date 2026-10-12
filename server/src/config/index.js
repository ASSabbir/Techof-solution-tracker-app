require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/techof-tracker',
  // Falls back to a built-in secret if JWT_SECRET isn't set. Set your own in Vercel to keep logins private to you.
  jwtSecret: process.env.JWT_SECRET || 'techof-default-secret-change-me',
  // Logins last a year, so nobody has to sign in again and again (JWT_EXPIRES_IN env vars are ignored on purpose).
  jwtExpiresIn: '365d',
  jwtRememberExpiresIn: '365d',
  clientUrls: (process.env.CLIENT_URL || '*').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: process.env.APP_TIMEZONE || 'Asia/Dhaka',
  seedPassword: process.env.SEED_PASSWORD || 'TechOf@2026',
};

module.exports = config;