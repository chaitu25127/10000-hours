(function() {
  const KEY = 'theme';
  const DARK = 'dark';
  const LIGHT = 'light';

  function getStored() {
    return localStorage.getItem(KEY);
  }

  function getPreferred() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
  }

  function apply(theme) {
    document.documentElement.classList.toggle(DARK, theme === DARK);
    localStorage.setItem(KEY, theme);
    const btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = theme === DARK ? 'LIGHT' : 'DARK';
  }

  function toggle() {
    const isDark = document.documentElement.classList.contains(DARK);
    apply(isDark ? LIGHT : DARK);
  }

  const theme = getStored() || getPreferred();
  apply(theme);

  window.toggleTheme = toggle;
})();
