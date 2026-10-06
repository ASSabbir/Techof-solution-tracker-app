require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/techof-tracker',
  // Falls back to a built-in secret if JWT_SECRET isn't set. Set your own in Vercel to make logins private to you.
  jwtSecret: process.env.JWT_SECRET || 'techof-default-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '90d',
  clientUrls: (process.env.CLIENT_URL || '*').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: process.env.APP_TIMEZONE || 'Asia/Dhaka',
  seedPassword: process.env.SEED_PASSWORD || 'TechOf@2026',
};

module.exports = config;