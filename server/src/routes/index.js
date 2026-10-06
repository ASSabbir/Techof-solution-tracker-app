const express = require('express');
const { protect } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/security');
const auth = require('../controllers/auth.controller');
const users = require('../controllers/users.controller');
const tasks = require('../controllers/tasks.controller');
const ext = require('../controllers/extensions.controller');
const att = require('../controllers/attendance.controller');
const leave = require('../controllers/leave.controller');
const misc = require('../controllers/misc.controller');

const api = express.Router();

api.get('/health', (_req, res) => res.json({ ok: true, data: { status: 'up', time: new Date().toISOString() } }));

/* /api/auth */
const authR = express.Router();
authR.post('/login', loginLimiter, auth.login);
authR.post('/logout', protect, auth.logout);
authR.get('/me', protect, auth.me);
authR.post('/change-password', protect, auth.changePassword);
api.use('/auth', authR);

// Everything below requires a valid session.
api.use(protect);

/* /api/users */
const usersR = express.Router();
usersR.get('/', users.list);
usersR.patch('/me', users.updateMe);
usersR.get('/:id', users.profile);
api.use('/users', usersR);

/* /api/tasks */
const tasksR = express.Router();
tasksR.post('/', tasks.create);
tasksR.get('/', tasks.listTeam);
tasksR.get('/my', tasks.listMine);
tasksR.get('/:id', tasks.get);
tasksR.patch('/:id', tasks.update);
tasksR.post('/:id/complete', tasks.complete);
tasksR.post('/:id/cancel', tasks.cancel);
tasksR.post('/:id/extensions', tasks.requestExtension);
tasksR.get('/:id/extensions', tasks.listExtensions);
api.use('/tasks', tasksR);

/* /api/extensions (alias: /api/task-extensions) */
const extR = express.Router();
extR.get('/pending', ext.pending);
extR.patch('/:id/approve', ext.approve);
extR.patch('/:id/reject', ext.reject);
api.use('/extensions', extR);
api.use('/task-extensions', extR);

/* /api/attendance */
const attR = express.Router();
attR.post('/clock-in', att.clockIn);
attR.post('/clock-out', att.clockOut);
attR.get('/today', att.today);
attR.get('/history', att.history);
attR.get('/stats', att.stats);
attR.get('/team', att.team);
attR.get('/day/:date', att.day);
api.use('/attendance', attR);

/* /api/leave */
const leaveR = express.Router();
leaveR.post('/', leave.create);
leaveR.get('/', leave.list);
leaveR.patch('/:id/approve', leave.approve);
leaveR.patch('/:id/reject', leave.reject);
leaveR.patch('/:id/cancel', leave.cancel);
api.use('/leave', leaveR);

api.get('/leaderboard', misc.leaderboard);
api.get('/dashboard', misc.dashboard);
api.get('/activity', misc.activity);
api.get('/settings', misc.getSettings);
api.patch('/settings', misc.updateSettings);

const notifR = express.Router();
notifR.get('/', misc.notifications);
notifR.post('/read-all', misc.markAllRead);
notifR.patch('/:id/read', misc.markRead);
api.use('/notifications', notifR);

module.exports = api;
