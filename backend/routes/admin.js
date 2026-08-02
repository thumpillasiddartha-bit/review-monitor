const express = require('express');
const router = express.Router();
const { Review, Product, User, Activity } = require('../modules/models');
const { protect, adminOnly } = require('../config/auth');

router.use(protect, adminOnly);

// GET /api/admin/queue — reviews pending admin review
router.get('/queue', async (req, res) => {
  try {
    const { status = 'admin_review', page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ status })
        .populate('user', 'name email flaggedCount reviewCount')
        .populate('product', 'name category')
        .sort('-analysisScore')
        .skip(+skip).limit(+limit),
      Review.countDocuments({ status })
    ]);

    res.json({ reviews, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/reviews/all — all reviews with filters
router.get('/reviews/all', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('user', 'name email')
        .populate('product', 'name')
        .sort('-createdAt')
        .skip(+skip).limit(+limit),
      Review.countDocuments(filter)
    ]);

    res.json({ reviews, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/reviews/:id/approve
router.patch('/reviews/:id/approve', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', reviewedBy: req.user._id, reviewedAt: new Date(), adminNote: req.body.note || '' },
      { new: true }
    ).populate('product');

    if (!review) return res.status(404).json({ error: 'Review not found' });

    // Recalculate product rating
    const allApproved = await Review.find({ product: review.product._id, status: 'approved' });
    const avg = allApproved.reduce((a, r) => a + r.rating, 0) / (allApproved.length || 1);
    await Product.findByIdAndUpdate(review.product._id, {
      avgRating: +avg.toFixed(2), totalReviews: allApproved.length
    });

    await Activity.create({
      type: 'approve', review: review._id,
      admin: req.user._id, user: review.user,
      message: `Admin approved review`, score: review.analysisScore
    });

    res.json({ message: 'Review approved', review });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: 'deleted', reviewedBy: req.user._id, reviewedAt: new Date(), adminNote: req.body.note || '' },
      { new: true }
    );
    if (!review) return res.status(404).json({ error: 'Review not found' });

    await Activity.create({
      type: 'admin_delete', review: review._id,
      admin: req.user._id, user: review.user,
      message: req.body.note || 'Admin deleted review',
      score: review.analysisScore
    });

    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/activity — recent activity log
router.get('/activity', async (req, res) => {
  try {
    const activity = await Activity.find()
      .populate('admin', 'name')
      .populate('user', 'name')
      .populate('review', 'text analysisScore')
      .sort('-createdAt')
      .limit(50);
    res.json(activity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users — all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort('-createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { banned: req.body.banned }, { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort('-createdAt');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/products
router.post('/products', async (req, res) => {
  try {
    const { name, category, description } = req.body;
    const product = await Product.create({ name, category, description });
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
