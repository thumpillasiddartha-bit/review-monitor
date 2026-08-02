const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ── USER MODEL ───────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  role:      { type: String, enum: ['user','admin'], default: 'user' },
  avatar:    { type: String, default: '' },
  banned:    { type: Boolean, default: false },
  reviewCount: { type: Number, default: 0 },
  flaggedCount:{ type: Number, default: 0 },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function(entered) {
  return bcrypt.compare(entered, this.password);
};

// ── PRODUCT MODEL ────────────────────────────────────────────
const productSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  category:    { type: String, required: true },
  description: { type: String },
  image:       { type: String, default: '' },
  avgRating:   { type: Number, default: 0 },
  totalReviews:{ type: Number, default: 0 },
}, { timestamps: true });

// ── REVIEW MODEL ─────────────────────────────────────────────
const reviewSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:      { type: String, required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },

  // Detection results
  status: {
    type: String,
    enum: ['pending','approved','flagged','admin_review','deleted','auto_deleted'],
    default: 'pending'
  },
  analysisScore:   { type: Number, default: 0 },
  verdict:         { type: String, default: '' },
  action:          { type: String, default: '' },
  analysisDetails: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Admin handling
  adminNote:       { type: String, default: '' },
  reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt:      { type: Date },
}, { timestamps: true });

// ── ACTIVITY LOG ─────────────────────────────────────────────
const activitySchema = new mongoose.Schema({
  type:    { type: String, required: true }, // 'auto_delete','admin_delete','approve','flag'
  review:  { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  admin:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  message: { type: String },
  score:   { type: Number },
}, { timestamps: true });

const User     = mongoose.model('User',     userSchema);
const Product  = mongoose.model('Product',  productSchema);
const Review   = mongoose.model('Review',   reviewSchema);
const Activity = mongoose.model('Activity', activitySchema);

module.exports = { User, Product, Review, Activity };
