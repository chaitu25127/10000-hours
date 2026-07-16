const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db/db');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res, next) => {
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL environment variable is not set. Add your Neon PostgreSQL connection string in Vercel dashboard.' });
  }
  db.ensureInit().then(next).catch(err => {
    console.error('Init error:', err?.message || err);
    res.status(500).json({ error: 'Server initialization failed. Check Vercel logs for details.' });
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;