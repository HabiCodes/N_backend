const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { port, clientOrigins } = require('./config/env');
const { initSockets } = require('./sockets');

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: clientOrigins, credentials: true },
});

initSockets(io);

httpServer.listen(port, () => {
  console.log(`[server] Listening on port ${port}`);
  console.log(`[server] Health check: http://localhost:${port}/health`);
});
