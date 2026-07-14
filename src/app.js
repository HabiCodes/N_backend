const express = require('express');
const cors = require('cors');
const { clientOrigins } = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const callRoutes = require('./routes/callRoutes');

const app = express();

app.use(cors({ origin: clientOrigins, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

app.use('/api/calls', callRoutes);

module.exports = app;
