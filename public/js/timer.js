const TEN_THOUSAND_HOURS = 36000000;

let task = null;
let sessions = [];
let remainingSeconds = TEN_THOUSAND_HOURS;
let totalSeconds = 0;
let isRunning = false;
let sessionStart = null;
let timerInterval = null;
let elapsedBefore = 0;

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

function loadSessions() {
  const list = document.getElementById('session-list');
  list.innerHTML = '';

  if (sessions.length === 0) {
    list.innerHTML = '<div class="session-item" style="color:var(--gray)">No sessions yet</div>';
    return;
  }

  sessions.forEach(s => {
    const d = new Date(s.started_at);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const el = document.createElement('div');
    el.className = 'session-item';
    el.innerHTML = `
      <span>${dateStr}</span>
      <span class="session-time">+${formatDuration(s.duration_seconds)}</span>
    `;
    list.appendChild(el);
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

    const timeLeft = document.getElementById('timer-label');
    const displaySecs = remainingSeconds;
    const h = Math.floor(displaySecs / 3600);
    const m = Math.floor((displaySecs % 3600) / 60);
    timeLeft.textContent = `${h.toLocaleString('en')} hours, ${m} minutes remaining of 10,000`;

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
    remainingSeconds = data.remaining_seconds;
    totalSeconds = data.total_seconds;
    updateDisplay(remainingSeconds);

    sessions.unshift({
      id: data.session.id,
      duration_seconds: data.session.duration_seconds,
      started_at: new Date().toISOString()
    });
    loadSessions();

    const timeLeft = document.getElementById('timer-label');
    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    timeLeft.textContent = `${h.toLocaleString('en')} hours, ${m} minutes remaining of 10,000`;
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

document.addEventListener('DOMContentLoaded', () => {
  if (!API.isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  loadTask();

  document.getElementById('start-btn').addEventListener('click', startTimer);
  document.getElementById('stop-btn').addEventListener('click', async () => {
    if (isRunning) {
      await stopTimer();
    }
  });
});
