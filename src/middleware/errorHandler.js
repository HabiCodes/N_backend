// Centralized error handler - keep controllers throwing plain Errors,
// this catches them so no route can crash the process.
function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  if (err.code === '23505') { // Postgres unique violation
    return res.status(409).json({ error: 'That value is already in use' });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { errorHandler };
