const CallModel = require('../models/callModel');

async function listCalls(req, res, next) {
  try {
    const calls = await CallModel.listForUser(req.userId);
    res.json({ calls });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCalls };