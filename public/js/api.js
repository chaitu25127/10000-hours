const API = {
  getToken() {
    return localStorage.getItem('token');
  },

  setToken(token) {
    localStorage.setItem('token', token);
  },

  clearToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getHeaders() {
    const token = this.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  },

  async request(method, url, body) {
    const opts = { method, headers: this.getHeaders() };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  del(url) { return this.request('DELETE', url); },

  async signup(username, email, password) {
    const data = await this.post('/api/auth/signup', { username, email, password });
    this.setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  async login(email, password) {
    const data = await this.post('/api/auth/login', { email, password });
    this.setToken(data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  },

  logout() {
    this.clearToken();
    window.location.href = '/login.html';
  },

  getUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  async getTasks() {
    return this.get('/api/tasks');
  },

  async createTask(name, description) {
    return this.post('/api/tasks', { name, description });
  },

  async getTask(id) {
    return this.get(`/api/tasks/${id}`);
  },

  async deleteTask(id) {
    return this.del(`/api/tasks/${id}`);
  },

  async saveSession(taskId, durationSeconds, startedAt) {
    const body = { duration_seconds: Math.round(durationSeconds) };
    if (startedAt) body.started_at = startedAt;
    return this.post(`/api/tasks/${taskId}/sessions`, body);
  },

  async updateSession(taskId, sessionId, durationSeconds, startedAt) {
    return this.put(`/api/tasks/${taskId}/sessions/${sessionId}`, {
      duration_seconds: Math.round(durationSeconds),
      started_at: startedAt
    });
  },

  async deleteSession(taskId, sessionId) {
    return this.del(`/api/tasks/${taskId}/sessions/${sessionId}`);
  }
};
