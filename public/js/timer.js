const TEN_THOUSAND_HOURS = 36000000;
const SECONDS_IN_A_DAY = 86400;

let task = null;
let sessions = [];
let remainingSeconds = TEN_THOUSAND_HOURS;
let totalSeconds = 0;
let isRunning = false;
let sessionStart = null;
let timerInterval = null;
let elapsedBefore = 0;
let editingSessionId = null;

function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toLocaleString('en')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const totalSeconds = Math.round(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function toLocalDateStr(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function updateDisplay(remaining) {
  const el = document.getElementById('timer-display');
  el.textContent = formatTime(remaining);

  const pct = ((TEN_THOUSAND_HOURS - remaining) / TEN_THOUSAND_HOURS) * 100;
  document.getElementById('progress-fill').style.width = `${Math.min(100, pct)}%`;
}

function updateElapsedDisplay() {
  if (!isRunning) return;
  const now = Date.now();
  const elapsed = elapsedBefore + (now - sessionStart) / 1000;
  const remaining = Math.max(0, remainingSeconds - elapsed);
  updateDisplay(remaining);
}

function updateTotals(data) {
  remainingSeconds = data.remaining_seconds;
  totalSeconds = data.total_seconds;
  updateDisplay(remainingSeconds);
  const h = Math.floor(remainingSeconds / 3600);
  const m = Math.floor((remainingSeconds % 3600) / 60);
  document.getElementById('timer-label').textContent = `${h.toLocaleString('en')} hours, ${m} minutes remaining of 10,000`;
}

function loadSessions() {
  const list = document.getElementById('session-list');
  list.innerHTML = '';

  if (sessions.length === 0) {
    list.innerHTML = '<div class="session-item" style="color:var(--gray)">No sessions yet</div>';
    return;
  }

  sessions.forEach(s => {
    const el = document.createElement('div');
    el.className = 'session-item';
    el.innerHTML = `
      <span>${formatDate(s.started_at)}</span>
      <span>
        <span class="session-time">+${formatDuration(s.duration_seconds)}</span>
        <button class="session-edit-btn" data-id="${s.id}" data-duration="${s.duration_seconds}" data-date="${toLocalDateStr(s.started_at)}">&#9998;</button>
        <button class="session-del-btn" data-id="${s.id}">&#10005;</button>
      </span>
    `;
    list.appendChild(el);
  });

  list.querySelectorAll('.session-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openEditModal(
        parseInt(btn.dataset.id),
        parseInt(btn.dataset.duration),
        btn.dataset.date
      );
    });
  });

  list.querySelectorAll('.session-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this session?')) {
        await deleteSession(parseInt(btn.dataset.id));
      }
    });
  });
}

async function loadTask() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    window.location.href = '/dashboard.html';
    return;
  }

  try {
    const data = await API.getTask(id);
    task = data.task;
    sessions = data.sessions || [];
    remainingSeconds = task.remaining_seconds;
    totalSeconds = task.total_seconds;

    document.getElementById('timer-task-name').textContent = task.name;
    updateDisplay(remainingSeconds);
    loadSessions();

    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    document.getElementById('timer-label').textContent = `${h.toLocaleString('en')} hours, ${m} minutes remaining of 10,000`;

    document.getElementById('start-btn').disabled = false;
  } catch (err) {
    if (err.message.includes('Authentication')) {
      window.location.href = '/login.html';
    } else if (err.message.includes('not found')) {
      window.location.href = '/dashboard.html';
    }
  }
}

async function stopTimer() {
  if (!isRunning) return;
  isRunning = false;
  clearInterval(timerInterval);

  const now = Date.now();
  const elapsed = elapsedBefore + (now - sessionStart) / 1000;

  document.getElementById('start-btn').textContent = 'START';
  document.getElementById('start-btn').classList.remove('timer-btn-active');

  if (elapsed < 1) return;

  try {
    const data = await API.saveSession(task.id, elapsed);
    sessions.unshift({
      id: data.session.id,
      duration_seconds: data.session.duration_seconds,
      started_at: new Date().toISOString()
    });
    loadSessions();
    updateTotals(data);
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

function startTimer() {
  if (isRunning) {
    stopTimer();
    return;
  }

  isRunning = true;
  sessionStart = Date.now();
  elapsedBefore = 0;

  document.getElementById('start-btn').textContent = 'STOP';
  document.getElementById('start-btn').classList.add('timer-btn-active');

  timerInterval = setInterval(updateElapsedDisplay, 100);
}

// -- Manual Entry Modal --

function openManualModal() {
  editingSessionId = null;
  document.getElementById('modal-title').textContent = 'Add manual session';
  document.getElementById('session-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('session-hours').value = '';
  document.getElementById('session-minutes').value = '';
  document.getElementById('session-seconds').value = '';
  document.getElementById('manual-modal').style.display = '';
}

function openEditModal(id, durationSeconds, dateStr) {
  editingSessionId = id;
  document.getElementById('modal-title').textContent = 'Edit session';
  document.getElementById('session-date').value = dateStr;
  const h = Math.floor(durationSeconds / 3600);
  const m = Math.floor((durationSeconds % 3600) / 60);
  const s = durationSeconds % 60;
  document.getElementById('session-hours').value = h || '';
  document.getElementById('session-minutes').value = m || '';
  document.getElementById('session-seconds').value = s || '';
  document.getElementById('manual-modal').style.display = '';
}

function closeModal() {
  document.getElementById('manual-modal').style.display = 'none';
  editingSessionId = null;
}

async function saveManualSession() {
  const date = document.getElementById('session-date').value;
  const h = parseInt(document.getElementById('session-hours').value) || 0;
  const m = parseInt(document.getElementById('session-minutes').value) || 0;
  const s = parseInt(document.getElementById('session-seconds').value) || 0;
  const totalSecs = h * 3600 + m * 60 + s;

  if (totalSecs < 1) {
    alert('Please enter a valid duration.');
    return;
  }

  try {
    let data;
    if (editingSessionId) {
      data = await API.updateSession(task.id, editingSessionId, totalSecs, date);
      const idx = sessions.findIndex(s => s.id === editingSessionId);
      if (idx !== -1) {
        sessions[idx].duration_seconds = totalSecs;
        sessions[idx].started_at = date;
      }
    } else {
      data = await API.saveSession(task.id, totalSecs, date);
      sessions.unshift({
        id: data.session.id,
        duration_seconds: data.session.duration_seconds,
        started_at: date
      });
    }
    sessions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    loadSessions();
    updateTotals(data);
    closeModal();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteSession(sessionId) {
  try {
    const data = await API.deleteSession(task.id, sessionId);
    sessions = sessions.filter(s => s.id !== sessionId);
    loadSessions();
    updateTotals(data);
  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!API.isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  loadTask();

  document.getElementById('start-btn').addEventListener('click', startTimer);
  document.getElementById('manual-btn').addEventListener('click', openManualModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-save').addEventListener('click', saveManualSession);

  document.getElementById('manual-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('manual-modal')) closeModal();
  });
});
