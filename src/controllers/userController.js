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

module.exports = { search };
