require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const connectDB = require('./config/db');

const app = express();
connectDB();

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/users',   require('./routes/users'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin',   require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Seed route — creates default admin + products if DB is empty
app.post('/api/seed', async (req, res) => {
  try {
    const { User, Product } = require('./modules/models');
    const bcrypt = require('bcryptjs');

    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        name: 'Admin', email: 'admin@reviewmonitor.com',
        password: 'Admin@123', role: 'admin'
      });
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.insertMany([
        { name: 'Wireless Noise-Cancelling Headphones', category: 'Electronics', description: 'Premium over-ear headphones with 30hr battery.' },
        { name: 'Ergonomic Office Chair', category: 'Furniture', description: 'Lumbar support mesh chair for all-day comfort.' },
        { name: 'Stainless Steel Water Bottle', category: 'Kitchen', description: 'Double-walled insulation, keeps drinks cold 24h.' },
        { name: 'Running Shoes Pro X', category: 'Sports', description: 'Lightweight responsive foam sole for marathon runners.' },
        { name: 'Smart LED Desk Lamp', category: 'Electronics', description: 'Touch-sensitive dimmer with USB-C charging port.' },
        { name: 'Organic Green Tea (100 bags)', category: 'Food', description: 'Premium Japanese matcha-grade sencha tea.' },
      ]);
    }

    res.json({ message: 'Seeded successfully. Admin: admin@reviewmonitor.com / Admin@123' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));