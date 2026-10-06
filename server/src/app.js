const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const { sanitize, serverTime, apiLimiter } = require('./middleware/security');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);

// Open CORS: any frontend origin may call this API (fine for a private 3-person tool).
// Must stay first so browser preflight (OPTIONS) requests are answered before anything else.
app.use(
  cors({
    origin: true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Server-Time'],
    maxAge: 86400,
  })
);
app.options('*', cors({ origin: true }));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
if (!config.isProd) app.use(morgan('dev'));
app.use(express.json({ limit: '400kb' }));
app.use(sanitize);
app.use(serverTime);
app.use('/api', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;