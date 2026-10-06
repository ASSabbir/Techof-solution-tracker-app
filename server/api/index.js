// Vercel serverless entry: answer CORS preflight first, then connect (cached) and hand off to Express.
const connectDB = require('../src/config/db');
const app = require('../src/app');

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Server-Time');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async (req, res) => {
  cors(req, res);

  // Preflight never needs the database.
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await connectDB();
  } catch (err) {
    console.error('[db] connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, code: 'DB_UNAVAILABLE', message: `Database connection failed: ${err.message}` }));
  }
  return app(req, res);
};