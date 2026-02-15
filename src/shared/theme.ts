/**
 * Theme Management System
 */

export type Theme = 'light' | 'dark' | 'auto';

/**
 * Apply theme to the document
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;

  if (theme === 'auto') {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

/**
 * Get current system theme preference
 */
export function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Listen for system theme changes
 */
export function watchSystemTheme(callback: (theme: 'light' | 'dark') => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', handler);

  // Return cleanup function
  return () => mediaQuery.removeEventListener('change', handler);
}
