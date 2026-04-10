import { useEffect } from 'react';

const DEFAULT_THEME = 'default';

const applyTheme = (themeName) => {
  const safeTheme = themeName || DEFAULT_THEME;
  document.body.dataset.theme = safeTheme;
};

const getThemeFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('theme');
};

const useExtensionTheme = () => {
  useEffect(() => {
    const urlTheme = getThemeFromUrl();
    const initialTheme = urlTheme || localStorage.getItem('swm-theme') || DEFAULT_THEME;
    applyTheme(initialTheme);
    localStorage.setItem('swm-theme', initialTheme);

    const handleStorage = (changes, areaName) => {
      if (areaName !== 'local' || !changes.activeTheme) return;
      const nextTheme = changes.activeTheme.newValue || DEFAULT_THEME;
      applyTheme(nextTheme);
      localStorage.setItem('swm-theme', nextTheme);
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['activeTheme'], (data) => {
        const extensionTheme = data?.activeTheme;
        if (extensionTheme) {
          applyTheme(extensionTheme);
          localStorage.setItem('swm-theme', extensionTheme);
        }
      });
      chrome.storage.onChanged.addListener(handleStorage);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorage);
      }
    };
  }, []);
};

export default useExtensionTheme;
