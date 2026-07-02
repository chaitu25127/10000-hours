const express = require('express');
const db = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const TEN_THOUSAND_HOURS = 36000000;

router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const tasks = db.all(`
      SELECT 
        t.id, t.name, t.description, t.created_at,
        COALESCE(SUM(s.duration_seconds), 0) AS total_seconds
      FROM tasks t
      LEFT JOIN sessions s ON s.task_id = t.id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, req.userId);

    const tasksWithProgress = tasks.map(t => ({
      ...t,
      remaining_seconds: Math.max(0, TEN_THOUSAND_HOURS - t.total_seconds),
      progress_percent: Math.min(100, (t.total_seconds / TEN_THOUSAND_HOURS) * 100)
    }));

    res.json({ tasks: tasksWithProgress });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Task name is required' });
  }

  try {
    const result = db.run('INSERT INTO tasks (user_id, name, description) VALUES (?, ?, ?)', req.userId, name.trim(), description || '');
    db.saveDb();
    const task = db.get('SELECT id, name, description, created_at FROM tasks WHERE id = ?', result.lastInsertRowid);
    res.status(201).json({
      task: {
        ...task,
        total_seconds: 0,
        remaining_seconds: TEN_THOUSAND_HOURS,
        progress_percent: 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const task = db.get(`
      SELECT 
        t.id, t.name, t.description, t.created_at,
        COALESCE(SUM(s.duration_seconds), 0) AS total_seconds
      FROM tasks t
      LEFT JOIN sessions s ON s.task_id = t.id
      WHERE t.id = ? AND t.user_id = ?
      GROUP BY t.id
    `, req.params.id, req.userId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const sessions = db.all('SELECT id, duration_seconds, started_at FROM sessions WHERE task_id = ? ORDER BY started_at DESC LIMIT 50', req.params.id);

    res.json({
      task: {
        ...task,
        remaining_seconds: Math.max(0, TEN_THOUSAND_HOURS - task.total_seconds),
        progress_percent: Math.min(100, (task.total_seconds / TEN_THOUSAND_HOURS) * 100)
      },
      sessions
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', req.params.id, req.userId);
    db.saveDb();
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/sessions', (req, res) => {
  const { duration_seconds } = req.body;

  if (!duration_seconds || duration_seconds < 1) {
    return res.status(400).json({ error: 'Valid duration_seconds is required' });
  }

  try {
    const task = db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = db.run('INSERT INTO sessions (task_id, duration_seconds) VALUES (?, ?)', req.params.id, duration_seconds);
    db.saveDb();

    const total = db.get('SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM sessions WHERE task_id = ?', req.params.id);

    res.status(201).json({
      session: { id: result.lastInsertRowid, task_id: parseInt(req.params.id), duration_seconds },
      total_seconds: total.total,
      remaining_seconds: Math.max(0, TEN_THOUSAND_HOURS - total.total),
      progress_percent: Math.min(100, (total.total / TEN_THOUSAND_HOURS) * 100)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
