const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { port, clientOrigins } = require('./config/env');
const { initSockets } = require('./sockets');
const { pool } = require('./config/db');

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: clientOrigins, credentials: true },
  pingInterval: 10000, // send a ping every 10s
  pingTimeout: 8000,   // if no pong within 8s, consider the socket dead
});

initSockets(io);

httpServer.listen(port, () => {
  console.log(`[server] Listening on port ${port}`);
  console.log(`[server] Health check: http://localhost:${port}/health`);
});

// Catch anything that slips past try/catch and controller error handlers
// so the process logs clearly instead of dying with no explanation.
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err);
  // Give logs a moment to flush, then exit - a process in an unknown
  // state after an uncaught exception shouldn't keep serving requests.
  gracefulShutdown(1);
});

// Render/most hosts send SIGTERM before killing the process on redeploy -
// this lets in-flight requests finish and closes the DB pool cleanly
// instead of dropping connections mid-request.
function gracefulShutdown(exitCode = 0) {
  console.log('[server] Shutting down gracefully...');
  httpServer.close(() => {
    console.log('[server] HTTP server closed');
    pool.end(() => {
      console.log('[server] Database pool closed');
      process.exit(exitCode);
    });
  });

  // Force-exit if graceful shutdown hangs for any reason
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout');
    process.exit(exitCode);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown(0));
process.on('SIGINT', () => gracefulShutdown(0));

module.exports = { httpServer, io };