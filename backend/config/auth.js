const jwt = require('jsonwebtoken');
const { User } = require('../modules/models');

const JWT_SECRET = process.env.JWT_SECRET || 'reviewmonitor_secret_2024';

const protect = async (req, res, next) => {
  let token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Not authorised' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ error: 'User not found' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
};

const generateToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });

module.exports = { protect, adminOnly, generateToken };
