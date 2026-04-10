document.addEventListener('DOMContentLoaded', () => {
  const openDashboard = () => {
    chrome.storage.local.get(['activeTheme'], (data) => {
      const theme = data.activeTheme || 'default';
      chrome.tabs.create({ url: `http://localhost:5173?theme=${encodeURIComponent(theme)}` });
    });
  };

  const timerDisplay = document.getElementById('timer-display');
  const goalInput = document.getElementById('goal-input');
  const actionBtn = document.getElementById('main-action-btn');
  const resetBtn = document.getElementById('reset-session-btn');
  const durationCards = document.querySelectorAll('.duration-card');
  const socialTrigger = document.getElementById('social-media-trigger');
  const tunnelToggle = document.getElementById('tunnel-vision-toggle');
  const blockToggle = document.getElementById('block-toggle');

  let selectedDuration = 25;

  // Load initial state
  chrome.storage.local.get(['remainingTime', 'isRunning', 'goal', 'tunnelVisionEnabled', 'blockingEnabled', 'endTime', 'activeScene', 'activeSound', 'activeTheme', 'blockedSites', 'userSession'], (data) => {
    updateTimerDisplay(data.remainingTime || 1500);
    updateActionBtn(data.isRunning, data.endTime);
    goalInput.value = data.goal || 'learn docker';
    tunnelToggle.checked = !!data.tunnelVisionEnabled;
    blockToggle.checked = !!data.blockingEnabled;

    // Cloud Status UI Update
    const cloudStatus = document.getElementById('cloud-status');
    if (cloudStatus) {
      if (data.userSession) {
        cloudStatus.classList.add('synced');
        cloudStatus.title = `Sync Status: Connected as ${data.userSession.user.email}`;
      } else {
        cloudStatus.classList.remove('synced');
        cloudStatus.title = 'Sync Status: Local Only (Click to Login)';
      }

      cloudStatus.addEventListener('click', () => {
        openDashboard();
      });
    }

    if (data.activeScene) {
      document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.dataset.scene === data.activeScene) opt.classList.add('active');
      });
    }

    if (data.activeTheme) {
      document.body.dataset.theme = data.activeTheme;
      document.querySelectorAll('.color-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.theme === data.activeTheme);
      });
    }

    if (data.activeSound) {
      updateSoundsUI(data.activeSound);
    } else {
      updateSoundsUI(null);
    }

    // Site Blocker Initialization
    const defaultSites = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'youtube.com', 'tiktok.com'];
    const blockedSites = data.blockedSites || defaultSites;
    if (!data.blockedSites) chrome.storage.local.set({ blockedSites });
    renderBlockedSites(blockedSites);
  });

  // Site Blocker Logic
  const siteInput = document.getElementById('blocked-site-input');
  const addSiteBtn = document.getElementById('add-site-btn');
  const siteListContainer = document.getElementById('blocked-sites-list');

  function renderBlockedSites(sites) {
    siteListContainer.innerHTML = sites.map(site => `
      <div class="blocked-site-tag">
        <span>${site}</span>
        <span class="remove-site" data-site="${site}">&times;</span>
      </div>
    `).join('');
  }

  function sanitizeDomain(input) {
    let domain = input.trim().toLowerCase();

    // Remove protocol (http, https)
    if (domain.includes('://')) {
      domain = domain.split('://')[1];
    }

    // Remove port, path, or query
    domain = domain.split('/')[0].split(':')[0].split('?')[0];

    // Remove 'www.' prefix if present
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }

    return domain;
  }

  addSiteBtn.addEventListener('click', () => {
    let site = sanitizeDomain(siteInput.value);
    if (site) {
      chrome.storage.local.get(['blockedSites'], (data) => {
        const sites = data.blockedSites || [];
        if (!sites.includes(site)) {
          sites.push(site);
          chrome.storage.local.set({ blockedSites: sites }, () => {
            renderBlockedSites(sites);
            siteInput.value = '';
          });
        }
      });
    }
  });

  siteListContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-site')) {
      const siteToRemove = e.target.dataset.site;
      chrome.storage.local.get(['blockedSites'], (data) => {
        const sites = (data.blockedSites || []).filter(s => s !== siteToRemove);
        chrome.storage.local.set({ blockedSites: sites }, () => {
          renderBlockedSites(sites);
        });
      });
    }
  });

  // Color Theme Selection
  const colorChips = document.querySelectorAll('.color-chip');
  colorChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const theme = chip.dataset.theme;
      document.body.dataset.theme = theme;
      colorChips.forEach(c => c.classList.toggle('active', c === chip));
      chrome.storage.local.set({ activeTheme: theme });
    });
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.remainingTime && !changes.remainingTime.newValue) return; // Prevent 0 blips
    if (changes.remainingTime) updateTimerDisplay(changes.remainingTime.newValue);

    if (changes.isRunning || changes.endTime) {
      chrome.storage.local.get(['isRunning', 'endTime'], (data) => {
        updateActionBtn(data.isRunning, data.endTime);
      });
    }

    if (changes.activeSound) {
      updateSoundsUI(changes.activeSound.newValue);
    }
  });

  // Goal Update
  goalInput.addEventListener('input', (e) => {
    chrome.storage.local.set({ goal: e.target.value });
  });

  // Duration Selection
  durationCards.forEach(card => {
    card.addEventListener('click', () => {
      durationCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedDuration = parseInt(card.dataset.time);
      chrome.runtime.sendMessage({ type: 'SET_DURATION', minutes: selectedDuration });
    });
  });

  // Accordions
  const accordions = document.querySelectorAll('.accordion-item');
  accordions.forEach(item => {
    const trigger = item.querySelector('.accordion-trigger');
    trigger.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Optional: close other accordions
      accordions.forEach(acc => acc.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });

  // Scene Selection
  const themeOptions = document.querySelectorAll('.theme-option');
  themeOptions.forEach(option => {
    option.addEventListener('click', () => {
      themeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      const scene = option.dataset.scene;

      // Map scenes to internal extension assets
      const sceneFiles = {
        'forest': 'assets/themes/forest_bg.png',
        'cafe': 'assets/themes/cafe_bg.png',
        'rain': 'assets/themes/rain_bg.png',
        'library': 'assets/themes/library_bg.png',
        'space': 'assets/themes/space_bg.png'
      };

      const sceneUrl = chrome.runtime.getURL(sceneFiles[scene]);

      chrome.storage.local.set({
        activeScene: scene,
        activeSceneUrl: sceneUrl
      });
    });
  });

  // Sound Selection
  const soundOptions = document.querySelectorAll('.sound-option');
  const soundToggleBtn = document.getElementById('sound-play-toggle');

  soundOptions.forEach(option => {
    option.addEventListener('click', () => {
      const sound = option.dataset.sound;
      chrome.runtime.sendMessage({ type: 'PLAY_SOUND', sound });
    });
  });

  soundToggleBtn.addEventListener('click', () => {
    chrome.storage.local.get(['activeSound'], (data) => {
      if (data.activeSound) {
        chrome.runtime.sendMessage({ type: 'STOP_SOUND' });
      }
    });
  });

  function updateSoundsUI(activeSound) {
    soundOptions.forEach(opt => {
      opt.classList.remove('active');
      if (opt.dataset.sound === activeSound) opt.classList.add('active');
    });

    if (activeSound) {
      soundToggleBtn.innerText = 'Stop Music';
      soundToggleBtn.style.display = 'block';
    } else {
      soundToggleBtn.style.display = 'none';
    }
  }

  // Tunnel Vision Toggle
  tunnelToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ tunnelVisionEnabled: enabled });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_TUNNEL_VISION', enabled });
      }
    });
  });

  // Block Toggle
  blockToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ blockingEnabled: e.target.checked });
  });

  // Main Action (Start/Stop)
  actionBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isRunning', 'goal'], (data) => {
      if (data.isRunning) {
        chrome.runtime.sendMessage({ type: 'STOP_TIMER' });
      } else {
        const goal = data.goal || goalInput.value;
        if (!goal || goal.trim() === '') {
          goalInput.focus();
          return;
        }
        chrome.runtime.sendMessage({ type: 'START_TIMER' });
      }
    });
  });

  resetBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RESET_TIMER' });
  });

  // View Switching
  const views = document.querySelectorAll('.view');
  const tabItems = document.querySelectorAll('.tab-item');

  function switchView(viewId) {
    views.forEach(v => v.style.display = 'none');
    const targetView = document.getElementById(viewId);
    if (targetView) targetView.style.display = 'flex';

    tabItems.forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById(`nav-${viewId.split('-')[0]}`);
    if (activeTab) activeTab.classList.add('active');

    if (viewId === 'dashboard-view') {
      loadDashboardData();
    }
  }

  document.getElementById('nav-focus').addEventListener('click', () => switchView('focus-view'));
  document.getElementById('nav-dashboard').addEventListener('click', () => switchView('dashboard-view'));

  function loadDashboardData() {
    chrome.storage.local.get(['completedSessions', 'localInterruptions', 'interruptionsCount', 'distractions', 'dailyTargets'], (data) => {
      console.log('📊 StudyWithMe: Loading Today Data', data);
      
      const isToday = (dateString) => {
        if (!dateString) return false;
        const d = new Date(dateString);
        const today = new Date();
        return d.toDateString() === today.toDateString();
      };

      // 1. Stats (Filtered to Today)
      const goalsHit = document.getElementById('stat-goals');
      const interruptions = document.getElementById('stat-interruptions');
      
      const todaySessions = (data.completedSessions || []).filter(s => isToday(s.timestamp));
      
      // Fallback for interruptions: use timestamps if available, otherwise fallback to the old counter for today
      let todayIntsCount = (data.localInterruptions || []).filter(ts => isToday(ts)).length;
      if (todayIntsCount === 0 && data.interruptionsCount > 0) {
        todayIntsCount = data.interruptionsCount;
      }

      if (goalsHit) goalsHit.innerText = todaySessions.length;
      if (interruptions) interruptions.innerText = todayIntsCount;
      
      // 2. Distractions
      const distList = document.getElementById('distractions-list');
      const distractions = data.distractions || {};
      const sortedDist = Object.entries(distractions)
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .slice(0, 5); // Top 5
      
      if (distList) {
        if (sortedDist.length > 0) {
          distList.innerHTML = sortedDist.map(([domain, count]) => `
            <div class="distraction-item">
              <span class="distraction-domain">${domain}</span>
              <span class="distraction-count">${count}</span>
            </div>
          `).join('');
        } else {
          distList.innerHTML = '<p class="empty-state small">No distractions recorded yet.</p>';
        }
      }

      // 3. Targets
      renderDailyTargets(data.dailyTargets || []);
    });
  }

  // Daily Targets Logic
  const targetInput = document.getElementById('target-input');
  const addTargetBtn = document.getElementById('add-target-btn');
  const clearTargetsBtn = document.getElementById('clear-targets-btn');
  const targetsList = document.getElementById('targets-list');

  function renderDailyTargets(targets) {
    if (!targetsList) return;
    if (targets.length > 0) {
      targetsList.innerHTML = targets.map((t, index) => {
        // Migration/Sanity check: handle string items or object items
        const isObject = typeof t === 'object' && t !== null;
        const text = isObject ? t.text : t;
        const completed = isObject ? !!t.completed : false;

        return `
          <div class="target-item ${completed ? 'is-completed' : ''}">
            <div class="target-main" data-index="${index}">
              <span class="target-check">${completed ? '✓' : '○'}</span>
              <span class="target-text ${completed ? 'completed' : ''}">${text}</span>
            </div>
            <span class="delete-target" data-index="${index}">&times;</span>
          </div>
        `;
      }).join('');
    } else {
      targetsList.innerHTML = '<p class="empty-state small">No targets set for today.</p>';
    }
  }

  if (addTargetBtn && targetInput) {
    addTargetBtn.addEventListener('click', () => {
      const text = targetInput.value.trim();
      if (text) {
        chrome.storage.local.get(['dailyTargets'], (data) => {
          const targets = data.dailyTargets || [];
          targets.push({ text, completed: false });
          chrome.storage.local.set({ dailyTargets: targets }, () => {
            renderDailyTargets(targets);
            targetInput.value = '';
          });
        });
      }
    });

    targetInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTargetBtn.click();
    });
  }

  if (clearTargetsBtn) {
    clearTargetsBtn.addEventListener('click', () => {
      chrome.storage.local.set({ dailyTargets: [] }, () => {
        renderDailyTargets([]);
      });
    });
  }

  if (targetsList) {
    targetsList.addEventListener('click', (e) => {
      // Toggle Completion
      const targetMain = e.target.closest('.target-main');
      if (targetMain) {
        const index = parseInt(targetMain.dataset.index);
        chrome.storage.local.get(['dailyTargets'], (data) => {
          const targets = data.dailyTargets || [];
          // Handle migration on the fly if needed
          if (typeof targets[index] === 'string') {
            targets[index] = { text: targets[index], completed: true };
          } else {
            targets[index].completed = !targets[index].completed;
          }
          
          chrome.storage.local.set({ dailyTargets: targets }, () => {
            renderDailyTargets(targets);
          });
        });
        return;
      }

      // Delete Target
      if (e.target.classList.contains('delete-target')) {
        const index = parseInt(e.target.dataset.index);
        chrome.storage.local.get(['dailyTargets'], (data) => {
          const targets = data.dailyTargets || [];
          targets.splice(index, 1);
          chrome.storage.local.set({ dailyTargets: targets }, () => {
            renderDailyTargets(targets);
          });
        });
      }
    });
  }

  function updateTimerDisplay(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');

    const hBox = document.getElementById('timer-h');
    const mBox = document.getElementById('timer-m');
    const sBox = document.getElementById('timer-s');

    if (hBox) hBox.innerText = h;
    if (mBox) mBox.innerText = m;
    if (sBox) sBox.innerText = s;
  }

  let uiTimerInterval;

  function updateActionBtn(isRunning, endTime) {
    if (isRunning) {
      actionBtn.innerText = 'Stop Focus Session';
      actionBtn.classList.add('running');
      resetBtn.style.display = 'block';
      timerDisplay.style.display = 'flex';

      const updateTimer = () => {
        if (endTime) {
          const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          updateTimerDisplay(remaining);
          if (remaining <= 0 && uiTimerInterval) {
            clearInterval(uiTimerInterval);
            uiTimerInterval = null;
          }
        }
      };

      // Run once immediately
      updateTimer();

      // Start local UI timer only if not already running
      if (!uiTimerInterval) {
        uiTimerInterval = setInterval(updateTimer, 100);
      }
    } else {
      actionBtn.innerText = 'Start Focus Session';
      actionBtn.classList.remove('running');
      resetBtn.style.display = 'none';
      timerDisplay.style.display = 'none';
      if (uiTimerInterval) {
        clearInterval(uiTimerInterval);
        uiTimerInterval = null;
      }
    }
  }

  // Dashboard Navigation
  const viewAnalysisBtn = document.querySelector('#dashboard-view .secondary-btn.full-width');
  if (viewAnalysisBtn) {
    viewAnalysisBtn.addEventListener('click', () => {
      openDashboard();
    });
  }
});
