require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const config = {
  env,
  isProd: env === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/techof-tracker',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  jwtRememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '30d',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: process.env.APP_TIMEZONE || 'Asia/Dhaka',
  seedPassword: process.env.SEED_PASSWORD || 'TechOf@2026',
};

if (config.isProd && (config.jwtSecret.startsWith('dev-only') || config.jwtSecret.length < 24)) {
  throw new Error('JWT_SECRET must be set to a long random value in production.');
}

module.exports = config;
