const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { clientOrigins } = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const callRoutes = require('./routes/callRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiters');

const app = express();

// Render/Heroku/etc sit behind a reverse proxy - needed so req.ip
// and rate limiting see the real client IP, not the proxy's.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' })); // cap body size - avoid huge payload abuse

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// General rate limit on all API routes; auth routes layer stricter
// limits on top of this (see authRoutes.js).
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/calls', callRoutes);

// 404 + error handler must be LAST, after all real routes are mounted.
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

module.exports = app;