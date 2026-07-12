# WhatsApp Clone - Backend (Phase 1: Auth + Real-time Chat)

Node.js + Express + PostgreSQL + Socket.io. WebRTC call signaling is wired in
but untested end-to-end until you build a client - see `src/sockets/callHandler.js`
for the full event flow and comments explaining how it works.

## File structure

```
whatsapp-clone-backend/
├── package.json
├── .env.example
├── src/
│   ├── server.js              # entrypoint: HTTP server + Socket.io
│   ├── app.js                 # Express app: middleware + routes
│   ├── config/
│   │   ├── db.js              # Postgres pool
│   │   └── env.js             # centralized env var loading/validation
│   ├── models/
│   │   ├── schema.sql         # full DB schema
│   │   ├── migrate.js         # applies schema.sql -> run with `npm run migrate`
│   │   ├── userModel.js
│   │   ├── conversationModel.js
│   │   └── messageModel.js
│   ├── middleware/
│   │   ├── auth.js            # JWT check for REST routes
│   │   └── errorHandler.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   └── conversationController.js
│   ├── routes/
│   │   ├── authRoutes.js      # /api/auth/*
│   │   ├── userRoutes.js      # /api/users/*
│   │   └── conversationRoutes.js  # /api/conversations/*
│   ├── sockets/
│   │   ├── index.js           # socket entrypoint, wires everything together
│   │   ├── socketAuth.js      # JWT check for socket connections
│   │   ├── onlineUsers.js     # in-memory presence tracking
│   │   ├── chatHandler.js     # message send/read/typing events
│   │   └── callHandler.js     # WebRTC signaling events
│   └── utils/
│       ├── jwt.js
│       └── validators.js
```

## Local setup (test offline before pushing to Render)

1. Install Postgres locally (or use Docker: `docker run --name chatdb -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres`)
2. Create a database: `createdb chatdb`
3. `cp .env.example .env` and fill in `DATABASE_URL` (e.g. `postgresql://postgres:pass@localhost:5432/chatdb`), `DB_SSL=false`, and a `JWT_SECRET` (any long random string)
4. `npm install`
5. `npm run migrate` - creates all tables
6. `npm run dev` - starts the server with nodemon on `http://localhost:5000`
7. Check `http://localhost:5000/health` returns `{"status":"ok"}`

## Testing the REST API (before building UI)

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"habishek","email":"habi@test.com","password":"test123"}'

# Login (copy the "token" from the response)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"habi@test.com","password":"test123"}'

# Authenticated request
curl http://localhost:5000/api/auth/me -H "Authorization: Bearer <token>"
```

## Testing real-time chat (before building UI)

Use a quick Node script or a tool like Postman's Socket.io support. Minimal client example:

```js
const { io } = require('socket.io-client');
const socket = io('http://localhost:5000', { auth: { token: '<jwt_token>' } });

socket.on('connect', () => console.log('connected'));
socket.on('message:new', (data) => console.log('new message:', data));

socket.emit('message:send', {
  conversationId: '<uuid>',
  content: 'hey',
  clientMsgId: 'local-1'
}, (ack) => console.log('ack:', ack));
```

## Deploying to Render

1. Push this repo to GitHub
2. Create a new **Web Service** on Render, connect the repo
3. Create a Render **PostgreSQL** instance (free tier), copy its "Internal Database URL"
4. In the Web Service's environment variables, set `DATABASE_URL` to that URL, `DB_SSL=true`, plus `JWT_SECRET` and `CLIENT_ORIGIN`
5. Build command: `npm install`  |  Start command: `npm start`
6. After first deploy, run the migration once via Render's shell tab: `npm run migrate`

## What's NOT built yet (by design, per our plan)

- Image/audio media upload (needs a storage decision - R2/S3 recommended, discussed but deferred)
- Group chats (schema already supports it, just needs routes/UI)
- Push notifications for offline users
