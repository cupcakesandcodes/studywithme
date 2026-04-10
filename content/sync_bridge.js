// This script runs on localhost:5173 (The Dashboard)
// It catches the login session from React and hands it to the extension.

console.log('🌐 StudyWithMe: Sync Bridge Active');

window.addEventListener('STUDY_WITH_ME_SYNC', (event) => {
  const session = event.detail.session;
  if (session) {
    console.log('🔑 StudyWithMe: Session Detected, Bridging to Extension...');
    try {
      if (!chrome?.runtime?.sendMessage) throw new Error("Extension Context Invalid");
      chrome.runtime.sendMessage({
        type: 'SYNC_USER',
        session: session
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('⚠️ Bridge Disconnected. Please refresh the page to reconnect.');
        } else {
          console.log('✅ Bridge Success: Session Handed to Background!');
        }
      });
    } catch (error) {
      console.warn('⚠️ Bridge offline. Please hard-refresh this page (F5) to restart the extension context.');
    }
  }
});

// Listen for requests for local extension data (like distractions)
window.addEventListener('REQUEST_EXTENSION_DATA', () => {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['distractions'], (data) => {
      window.dispatchEvent(new CustomEvent('EXTENSION_DATA_RESPONSE', {
        detail: data
      }));
    });
  }
});
window.addEventListener('REQUEST_THEME', () => {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['activeTheme'], (data) => {
      window.dispatchEvent(new CustomEvent('THEME_RESPONSE', {
        detail: data.activeTheme || 'default'
      }));
    });
  }
});
// Announce that the bridge is ready in case the React app had already loaded and requested data
window.dispatchEvent(new CustomEvent('EXTENSION_BRIDGE_READY'));
