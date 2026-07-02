(function() {
  const token = localStorage.getItem('token');
  if (token) {
    const user = API.getUser();
    if (user) {
      document.querySelectorAll('.auth-only').forEach(el => el.style.display = '');
      document.querySelectorAll('.no-auth').forEach(el => el.style.display = 'none');
      const nameEl = document.getElementById('nav-username');
      if (nameEl) nameEl.textContent = user.username;
    }
  } else {
    document.querySelectorAll('.auth-only').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.no-auth').forEach(el => el.style.display = '');
  }
})();
