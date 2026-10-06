const rateLimit = require('express-rate-limit');

// Strip Mongo operators ($where, $ne, ...) and dotted keys from user input.
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = clean(v);
    }
    return out;
  }
  return value;
}
exports.sanitize = (req, _res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.query) {
    const q = clean({ ...req.query });
    Object.defineProperty(req, 'query', { value: q, writable: true, configurable: true });
  }
  if (req.params) req.params = clean(req.params);
  next();
};

exports.serverTime = (_req, res, next) => {
  res.setHeader('X-Server-Time', String(Date.now()));
  next();
};

exports.apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
});

exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.identifier || '').toLowerCase()}`,
  validate: { keyGeneratorIpFallback: false, ip: false },
  message: { ok: false, code: 'RATE_LIMITED', message: 'Too many login attempts. Please try again in a few minutes.' },
});
