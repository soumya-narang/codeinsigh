function initThemeSwitcher() {
  const THEMES = ['default', 'dark'];
  const STORAGE_KEY = 'codeinsigh-theme';
  
  // Load saved theme
  let currentTheme = localStorage.getItem(STORAGE_KEY) || 'default';
  
  // Fallback for old themes
  if (!THEMES.includes(currentTheme)) currentTheme = 'default';
  
  document.documentElement.setAttribute('data-theme', currentTheme);

  // Create theme switcher button
  const themeBtn = document.createElement('button');
  themeBtn.className = 'theme-switcher-btn';
  themeBtn.setAttribute('aria-label', 'Toggle color theme');
  themeBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  `;
  document.body.appendChild(themeBtn);

  // Toggle theme on click
  themeBtn.addEventListener('click', () => {
    let currentIndex = THEMES.indexOf(currentTheme);
    if (currentIndex === -1) currentIndex = 0;
    
    // Move to next theme
    currentIndex = (currentIndex + 1) % THEMES.length;
    currentTheme = THEMES[currentIndex];
    
    // Apply and save
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem(STORAGE_KEY, currentTheme);
  });
}

document.addEventListener('DOMContentLoaded', initThemeSwitcher);
