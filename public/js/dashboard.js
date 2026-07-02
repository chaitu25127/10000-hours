function formatTime(seconds) {
  const totalSeconds = Math.round(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toLocaleString('en')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDuration(seconds) {
  const totalSeconds = Math.round(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${totalSeconds % 60}s`;
}

const TEN_THOUSAND_HOURS = 36000000;

async function loadTasks() {
  try {
    const data = await API.getTasks();
    const list = document.getElementById('task-list');
    const empty = document.getElementById('empty-state');

    list.innerHTML = '';

    if (data.tasks.length === 0) {
      empty.style.display = '';
      return;
    }

    empty.style.display = 'none';

    data.tasks.forEach(task => {
      const remainingDisplay = formatTime(task.remaining_seconds);
      const totalDisplay = formatDuration(task.total_seconds);
      const pct = task.progress_percent.toFixed(2);

      const el = document.createElement('a');
      el.href = `/timer.html?id=${task.id}`;
      el.className = 'card';
      el.innerHTML = `
        <div class="card-title">${task.name}</div>
        <div class="card-meta">${totalDisplay} logged · ${pct}% of 10,000 hours</div>
        <div class="card-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
      list.appendChild(el);
    });
  } catch (err) {
    if (err.message.includes('Authentication')) {
      window.location.href = '/login.html';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!API.isAuthenticated()) {
    window.location.href = '/login.html';
    return;
  }

  loadTasks();

  const modal = document.getElementById('create-modal');
  const createBtn = document.getElementById('create-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const form = document.getElementById('create-form');
  const formError = document.getElementById('form-error');

  createBtn.addEventListener('click', () => {
    modal.style.display = '';
  });

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    formError.textContent = '';
    form.reset();
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      formError.textContent = '';
      form.reset();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.textContent = '';
    const name = document.getElementById('task-name').value.trim();

    if (!name) {
      formError.textContent = 'Task name is required';
      return;
    }

    try {
      await API.createTask(name, '');
      modal.style.display = 'none';
      form.reset();
      loadTasks();
    } catch (err) {
      formError.textContent = err.message;
    }
  });
});
