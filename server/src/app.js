const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { sanitize, serverTime, apiLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
if (config.isProd) app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const okOrigin = config.clientUrls.includes(origin) || (!config.isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
      cb(okOrigin ? null : new Error('Not allowed by CORS'), okOrigin);
    },
    exposedHeaders: ['X-Server-Time'],
    maxAge: 600,
  })
);
if (!config.isProd) app.use(morgan('dev'));
app.use(express.json({ limit: '400kb' }));
app.use(sanitize);
app.use(serverTime);
app.use('/api', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
