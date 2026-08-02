const express = require('express');
const router = express.Router();
const { User, Review, Activity } = require('../modules/models');
const { protect, generateToken } = require('../config/auth');

// POST /api/users/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });

    if (await User.findOne({ email }))
      return res.status(400).json({ error: 'Email already registered' });

    const user = await User.create({ name, email, password });
    res.status(201).json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ error: 'Invalid credentials' });
    if (user.banned)
      return res.status(403).json({ error: 'Account banned' });

    res.json({
      _id: user._id, name: user.name, email: user.email,
      role: user.role, token: generateToken(user._id)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/profile
router.get('/profile', protect, async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate('product', 'name category')
      .sort('-createdAt')
      .limit(20);
    res.json({ user: req.user, reviews });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
