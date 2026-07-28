const UserModel = require('../models/userModel');

async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const users = await UserModel.searchByUsername(q, req.userId);
    res.json({ users });
  } catch (err) {
    next(err);
  }
}
async function updateFcmToken(req, res, next) {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken is required' });
    await UserModel.updateFcmToken(req.userId, fcmToken);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, updateFcmToken };
