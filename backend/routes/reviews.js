const express = require('express');
const router = express.Router();
const { Review, Product, User, Activity } = require('../modules/models');
const { protect } = require('../config/auth');
const { analyseReview } = require('../modules/fakeDetector');
 
// POST /api/reviews  — submit a new review
router.post('/', protect, async (req, res) => {
  try {
    const { productId, text, rating } = req.body;
    if (!productId || !text || !rating)
      return res.status(400).json({ error: 'productId, text, rating required' });
 
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
 
    // Fetch existing reviews for duplicate detection
    const existing = await Review.find({ product: productId }).select('text').lean();
 
    // ── RUN DETECTION ──────────────────────────────────────
    const analysis = analyseReview(text, rating, existing);
 
    // Map action to status
    const statusMap = {
      AUTO_DELETE:   'auto_deleted',
      SEND_TO_ADMIN: 'admin_review',
      FLAG:          'flagged',
      APPROVE:       'approved',
    };
    const status = statusMap[analysis.action] || 'pending';
 
    const review = await Review.create({
      product: productId, user: req.user._id,
      text, rating, status,
      analysisScore:   analysis.score,
      verdict:         analysis.verdict,
      action:          analysis.action,
      analysisDetails: analysis.details,
    });
 
    // Update user flag count
    if (status === 'auto_deleted' || status === 'admin_review' || status === 'flagged') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { flaggedCount: 1 } });
    }
    await User.findByIdAndUpdate(req.user._id, { $inc: { reviewCount: 1 } });
 
    // Log activity for auto-deletions
    if (status === 'auto_deleted') {
      await Activity.create({
        type: 'auto_delete', review: review._id,
        user: req.user._id,
        message: `Auto-deleted: score ${analysis.score} — ${analysis.verdict}`,
        score: analysis.score,
      });
    }
 
    // Update product avg rating if approved
    if (status === 'approved') {
      const allApproved = await Review.find({ product: productId, status: 'approved' });
      const avg = allApproved.reduce((a, r) => a + r.rating, 0) / allApproved.length;
      await Product.findByIdAndUpdate(productId, {
        avgRating: +avg.toFixed(2),
        totalReviews: allApproved.length,
      });
    }
 
    res.status(201).json({ review, analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// GET /api/reviews/product/:id — approved reviews for a product
router.get('/product/:id', async (req, res) => {
  try {
    const reviews = await Review.find({
      product: req.params.id, status: 'approved'
    }).populate('user', 'name').sort('-createdAt');
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// GET /api/reviews/stats — dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [total, approved, autoDeleted, adminQueue, flagged] = await Promise.all([
      Review.countDocuments(),
      Review.countDocuments({ status: 'approved' }),
      Review.countDocuments({ status: 'auto_deleted' }),
      Review.countDocuments({ status: 'admin_review' }),
      Review.countDocuments({ status: 'flagged' }),
    ]);
 
    // Score distribution
    const scoreRanges = await Review.aggregate([
      { $bucket: {
        groupBy: '$analysisScore',
        boundaries: [0, 20, 40, 60, 80, 101],
        default: 'other',
        output: { count: { $sum: 1 } }
      }}
    ]);
 
    // Daily submissions (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const daily = await Review.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total:   { $sum: 1 },
        fakes:   { $sum: { $cond: [{ $in: ['$status', ['auto_deleted','admin_review']] }, 1, 0] } },
        legit:   { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
      }},
      { $sort: { _id: 1 } }
    ]);
 
    // Verdict distribution
    const verdicts = await Review.aggregate([
      { $group: { _id: '$verdict', count: { $sum: 1 } } }
    ]);
 
    res.json({ total, approved, autoDeleted, adminQueue, flagged, scoreRanges, daily, verdicts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
// GET /api/reviews/products — PUBLIC: all products (no auth needed)
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort('-createdAt');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
module.exports = router;
