exports.ok = (res, data, status = 200) => res.status(status).json({ ok: true, data });
