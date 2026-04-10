const SUPABASE_URL = 'https://jtnqrswupbjqobasrrjm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0bnFyc3d1cGJqcW9iYXNycmptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjI0MjUsImV4cCI6MjA4ODE5ODQyNX0.uE8kabu6gHQVwIEY6UgN0VmsZJhhkrvFWPu0HsvmMPM';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    remainingTime: 25 * 60,
    endTime: null,
    isRunning: false,
    activeSound: null,
    activeScene: 'forest',
    activeSceneUrl: chrome.runtime.getURL('assets/themes/forest_bg.png'),
    widgetEnabled: true,
    tunnelVisionEnabled: false,
    blockingEnabled: false,
    goal: 'learn docker',
    completedSessions: [],
    totalSitesVisited: 0,
    focusTimeTotal: 0,
    interruptionsCount: 0,
    distractions: {},
    localInterruptions: [],
    userSession: null // Track if user is "logged in" for sync
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📥 Extension Message:', message.type);

  if (message.type === 'START_TIMER') {
    startTimer();
  } else if (message.type === 'STOP_TIMER') {
    stopTimer();
  } else if (message.type === 'RESET_TIMER') {
    resetTimer();
  } else if (message.type === 'SET_DURATION') {
    chrome.storage.local.set({ remainingTime: message.minutes * 60 });
  } else if (message.type === 'PLAY_SOUND') {
    playAmbientSound(message.sound);
  } else if (message.type === 'STOP_SOUND') {
    stopAmbientSound();
  } else if (message.type === 'SYNC_USER') {
    chrome.storage.local.set({ userSession: message.session }, () => {
      console.log('✅ User Session Bridged:', message.session.user.email);
      sendResponse({ status: 'success' });
    });
    return true; // Keep channel open for async response
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusTimer') {
    handleSessionComplete();
  }
});

async function startTimer() {
  const data = await chrome.storage.local.get(['remainingTime']);
  const durationMs = data.remainingTime * 1000;
  const endTime = Date.now() + durationMs;

  await chrome.alarms.create('focusTimer', { when: endTime });
  await chrome.storage.local.set({
    isRunning: true,
    endTime: endTime,
    initialSessionDuration: data.remainingTime // Save the duration we're aiming for
  });
}

async function stopTimer() {
  await chrome.alarms.clear('focusTimer');
  const data = await chrome.storage.local.get(['isRunning', 'endTime', 'interruptionsCount']);

  if (data.isRunning && data.endTime) {
    const remaining = Math.max(0, Math.ceil((data.endTime - Date.now()) / 1000));
    
    // Local Tracking for "Today" stats
    const intData = await chrome.storage.local.get(['localInterruptions']);
    const localInts = intData.localInterruptions || [];
    localInts.push(new Date().toISOString());
    
    await chrome.storage.local.set({
      remainingTime: remaining,
      localInterruptions: localInts
    });

    // Sync Interruption to Cloud
    const goalData = await chrome.storage.local.get(['goal']);
    const goal = goalData.goal || 'Focus Session';
    const syncData = await chrome.storage.local.get(['userSession']);
    if (syncData.userSession) {
      syncInterruptionToCloud(goal, syncData.userSession);
    }
  }

  await chrome.storage.local.set({ isRunning: false, endTime: null, initialSessionDuration: null });
}

async function resetTimer() {
  await stopTimer();
  await chrome.storage.local.set({ remainingTime: 25 * 60, isRunning: false, endTime: null, initialSessionDuration: null });
}

async function handleSessionComplete() {
  const data = await chrome.storage.local.get(['goal', 'completedSessions', 'focusTimeTotal', 'initialSessionDuration']);
  await chrome.storage.local.set({ isRunning: false, endTime: null, initialSessionDuration: null });

  // Use the stored initial duration for accurate stats
  const duration = data.initialSessionDuration || 1500;
  const newSession = {
    goal: data.goal || 'Focus Session',
    timestamp: new Date().toISOString(),
    duration: duration
  };

  const sessions = data.completedSessions || [];
  sessions.push(newSession);

  await chrome.storage.local.set({
    completedSessions: sessions,
    focusTimeTotal: (data.focusTimeTotal || 0) + duration
  });

  // Sync to Cloud if user is logged in
  const syncData = await chrome.storage.local.get(['userSession']);
  if (syncData.userSession) {
    syncSessionToCloud(newSession, syncData.userSession);
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/themes/forest_bg.png'),
    title: 'Session Complete!',
    message: `Great job! You finished: ${data.goal}`,
    priority: 2
  });
}

// Site Blocker & Tracking
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return;

  chrome.storage.local.get(['blockingEnabled', 'isRunning', 'blockedSites'], (data) => {
    if (data.blockingEnabled && data.isRunning) {
      try {
        const url = new URL(details.url);
        const hostname = url.hostname.toLowerCase();
        const blockedSites = data.blockedSites || ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'youtube.com', 'tiktok.com'];

        const isBlocked = blockedSites.some(site => {
          const s = site.toLowerCase();
          return hostname === s || hostname.endsWith('.' + s);
        });

        if (isBlocked) {
          const blockedUrl = chrome.runtime.getURL('blocked.html');
          chrome.tabs.update(details.tabId, { url: blockedUrl });
        }
      } catch (e) {
        console.error(e);
      }
    }
  });
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    chrome.storage.local.get(['distractions', 'isRunning'], (data) => {
      if (data.isRunning) {
        try {
          const url = new URL(details.url);
          const hostname = url.hostname.toLowerCase();

          const distractions = data.distractions || {};
          distractions[hostname] = (distractions[hostname] || 0) + 1;

          chrome.storage.local.set({ distractions });
        } catch (e) {
          console.error(e);
        }
      }
    });
  }
});

async function playAmbientSound(sound) {
  await setupOffscreenDocument('offscreen.html');
  chrome.runtime.sendMessage({ type: 'PLAY_AUDIO', target: 'offscreen', sound }).catch(() => {});
  chrome.storage.local.set({ activeSound: sound });
}

async function stopAmbientSound() {
  chrome.runtime.sendMessage({ type: 'STOP_AUDIO', target: 'offscreen' }).catch(() => {});
  chrome.storage.local.set({ activeSound: null });
}

async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (existingContexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Handling audio playback.'
  });
}

// Sync session to Supabase
async function syncSessionToCloud(session, user) {
  console.log('📡 Syncing Session to Cloud...', { goal: session.goal, userId: user.user.id });
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/study_sessions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${user.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: user.user.id,
        goal: session.goal,
        duration: session.duration,
        timestamp: session.timestamp
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cloud Sync Failed. Status:', response.status, 'Error:', errorText);
    } else {
      console.log('✅ Cloud Sync Successful!');
    }
  } catch (error) {
    console.error('⚠️ Cloud Sync Connection Error:', error);
  }
}

// Sync interruption to Supabase
async function syncInterruptionToCloud(goal, user) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/study_interruptions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${user.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: user.user.id,
        goal_at_time: goal,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.error('Cloud Interruption Sync Failed:', await response.text());
    } else {
      console.log('✅ Interruption Sync Successful');
    }
  } catch (error) {
    console.error('Interruption Sync Error:', error);
  }
}


// Message handler for user sync is now at the top
