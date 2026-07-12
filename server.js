const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const { initSockets } = require('./src/sockets');

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: env.corsOrigin, methods: ['GET', 'POST'] },
  // Render free tier idles connections aggressively behind its proxy —
  // these keep long-lived sockets (like an open call) from being dropped.
  pingInterval: 25000,
  pingTimeout: 20000,
});

initSockets(io);

httpServer.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port} [${env.nodeEnv}]`);
});

// Don't let one bad promise silently kill the process on Render
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});
