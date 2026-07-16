const express = require('express');
const db = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const TEN_THOUSAND_HOURS = 36000000;

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const tasks = await db.all(`
      SELECT 
        t.id, t.name, t.description, t.created_at,
        COALESCE(SUM(s.duration_seconds), 0)::int AS total_seconds
      FROM tasks t
      LEFT JOIN sessions s ON s.task_id = t.id
      WHERE t.user_id = $1
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

router.post('/', async (req, res) => {
  const { name, description } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Task name is required' });
  }

  try {
    const result = await db.run(
      'INSERT INTO tasks (user_id, name, description) VALUES ($1, $2, $3) RETURNING id',
      req.userId, name.trim(), description || ''
    );

    const task = await db.get('SELECT id, name, description, created_at FROM tasks WHERE id = $1', result.lastInsertRowid);

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

router.get('/:id', async (req, res) => {
  try {
    const task = await db.get(`
      SELECT 
        t.id, t.name, t.description, t.created_at,
        COALESCE(SUM(s.duration_seconds), 0)::int AS total_seconds
      FROM tasks t
      LEFT JOIN sessions s ON s.task_id = t.id
      WHERE t.id = $1 AND t.user_id = $2
      GROUP BY t.id
    `, req.params.id, req.userId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const sessions = await db.all(
      'SELECT id, duration_seconds, started_at FROM sessions WHERE task_id = $1 ORDER BY started_at DESC LIMIT 50',
      req.params.id
    );

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

router.delete('/:id', async (req, res) => {
  try {
    const result = await db.run(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
      req.params.id, req.userId
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/sessions', async (req, res) => {
  const { duration_seconds, started_at } = req.body;

  if (!duration_seconds || duration_seconds < 1) {
    return res.status(400).json({ error: 'Valid duration_seconds is required' });
  }

  try {
    const task = await db.get('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let result;
    if (started_at) {
      result = await db.run(
        'INSERT INTO sessions (task_id, duration_seconds, started_at) VALUES ($1, $2, $3) RETURNING id',
        req.params.id, duration_seconds, started_at
      );
    } else {
      result = await db.run(
        'INSERT INTO sessions (task_id, duration_seconds) VALUES ($1, $2) RETURNING id',
        req.params.id, duration_seconds
      );
    }

    const total = await db.get(
      'SELECT COALESCE(SUM(duration_seconds), 0)::int AS total FROM sessions WHERE task_id = $1',
      req.params.id
    );

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

router.put('/:id/sessions/:sessionId', async (req, res) => {
  const { duration_seconds, started_at } = req.body;

  if (!duration_seconds || duration_seconds < 1) {
    return res.status(400).json({ error: 'Valid duration_seconds is required' });
  }

  try {
    const task = await db.get('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const existing = await db.get('SELECT id FROM sessions WHERE id = $1 AND task_id = $2', req.params.sessionId, req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await db.run(
      'UPDATE sessions SET duration_seconds = $1, started_at = $2 WHERE id = $3',
      duration_seconds, started_at || new Date().toISOString(), req.params.sessionId
    );

    const total = await db.get(
      'SELECT COALESCE(SUM(duration_seconds), 0)::int AS total FROM sessions WHERE task_id = $1',
      req.params.id
    );

    res.json({
      session: { id: parseInt(req.params.sessionId), task_id: parseInt(req.params.id), duration_seconds },
      total_seconds: total.total,
      remaining_seconds: Math.max(0, TEN_THOUSAND_HOURS - total.total),
      progress_percent: Math.min(100, (total.total / TEN_THOUSAND_HOURS) * 100)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/sessions/:sessionId', async (req, res) => {
  try {
    const task = await db.get('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', req.params.id, req.userId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await db.run(
      'DELETE FROM sessions WHERE id = $1 AND task_id = $2',
      req.params.sessionId, req.params.id
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const total = await db.get(
      'SELECT COALESCE(SUM(duration_seconds), 0)::int AS total FROM sessions WHERE task_id = $1',
      req.params.id
    );

    res.json({
      total_seconds: total.total,
      remaining_seconds: Math.max(0, TEN_THOUSAND_HOURS - total.total),
      progress_percent: Math.min(100, (total.total / TEN_THOUSAND_HOURS) * 100)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
