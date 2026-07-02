const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { authenticateToken, generateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const existing = db.get('SELECT id FROM users WHERE username = ? OR email = ?', username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', username, email, passwordHash);
    db.saveDb();

    const token = generateToken(result.lastInsertRowid);

    res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, username, email }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = db.get('SELECT * FROM users WHERE email = ?', email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user.id);

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.get('SELECT id, username, email, created_at FROM users WHERE id = ?', req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
