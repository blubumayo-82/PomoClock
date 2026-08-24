/**
 * PomoHaven - Your Cozy Focus Haven & Pomodoro Study Timer
 * Core JavaScript Engine: Timer Mechanics, Web Audio Chime,
 * Theme Management, Confetti Celebration, Hybrid Local Storage Persistence,
 * Optional User Authentication, PDF/CSV Reports & Analytics Dashboard
 */

// ==========================================================================
// 1. Application State & Constants
// ==========================================================================

const CIRCLE_RADIUS = 140;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~879.6459
const LOCAL_STORAGE_KEY_SESSIONS = 'pomohaven_local_sessions';

const state = {
  // Mode durations in seconds
  durations: {
    pomodoro: 25 * 60,
    short_break: 5 * 60,
    long_break: 15 * 60
  },
  currentMode: 'pomodoro', // 'pomodoro' | 'short_break' | 'long_break'
  timeLeft: 25 * 60,
  totalDuration: 25 * 60,
  isRunning: false,
  timerInterval: null,
  sessionStartTime: null,

  // Cycle tracking
  cycleCount: 1,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoro: false,

  // Audio settings
  soundEnabled: true,
  soundVolume: 0.8,
  soundType: 'zen', // 'zen' | 'bell' | 'digital' | 'marimba' | 'beep'
  audioContext: null,

  // Theme settings (Default: Classic Pomodoro)
  theme: 'pomodoro',
  customColors: {
    bg: '#1A1212',
    card: '#2A181A',
    accent: '#E05344',
    text: '#FFF5F5'
  },

  // Task goal
  currentTask: '',

  // Authentication State (Guest Mode by default)
  currentUser: null,
  authMode: 'login' // 'login' | 'register'
};

// Mode metadata configuration
const MODE_CONFIG = {
  pomodoro: {
    title: 'Focus',
    statusText: 'Focusing...',
    readyText: 'Ready to Focus',
    icon: '🎯'
  },
  short_break: {
    title: 'Short Break',
    statusText: 'Relax & Recharge',
    readyText: 'Take a Short Break',
    icon: '☕'
  },
  long_break: {
    title: 'Long Break',
    statusText: 'Rest & Recover',
    readyText: 'Enjoy a Long Break',
    icon: '🌴'
  }
};


// ==========================================================================
// 2. DOM Element Selectors
// ==========================================================================

const DOM = {
  // Timer elements
  timeDisplay: document.getElementById('timeDisplay'),
  statusBadge: document.getElementById('statusBadge'),
  progressCircle: document.getElementById('progressCircle'),
  playIcon: document.getElementById('playIcon'),
  pauseIcon: document.getElementById('pauseIcon'),
  startPauseText: document.getElementById('startPauseText'),
  startPauseBtn: document.getElementById('startPauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  skipBtn: document.getElementById('skipBtn'),
  zenModeBtn: document.getElementById('zenModeBtn'),
  zenExpandIcon: document.getElementById('zenExpandIcon'),
  zenCompressIcon: document.getElementById('zenCompressIcon'),
  // ETA & Cycle
  cycleIndicator: document.getElementById('cycleIndicator'),
  cycleLabel: document.getElementById('cycleLabel'),
  etaBadge: document.getElementById('etaBadge'),
  etaText: document.getElementById('etaText'),
  
  // Tabs & Badges
  tabPomodoro: document.getElementById('tabPomodoro'),
  tabShortBreak: document.getElementById('tabShortBreak'),
  tabLongBreak: document.getElementById('tabLongBreak'),
  badgePomodoro: document.getElementById('badgePomodoro'),
  badgeShortBreak: document.getElementById('badgeShortBreak'),
  badgeLongBreak: document.getElementById('badgeLongBreak'),
  
  // Task input & Multi-Task Queue
  currentTaskInput: document.getElementById('currentTaskInput'),
  clearTaskBtn: document.getElementById('clearTaskBtn'),
  taskQueueContainer: document.getElementById('taskQueueContainer'),
  toggleTaskQueueBtn: document.getElementById('toggleTaskQueueBtn'),
  taskQueueBadge: document.getElementById('taskQueueBadge'),
  queueArrow: document.getElementById('queueArrow'),
  openAddTaskBtn: document.getElementById('openAddTaskBtn'),
  addTaskForm: document.getElementById('addTaskForm'),
  newTaskTitleInput: document.getElementById('newTaskTitleInput'),
  stepperDecBtn: document.getElementById('stepperDecBtn'),
  stepperIncBtn: document.getElementById('stepperIncBtn'),
  newTargetPomoCount: document.getElementById('newTargetPomoCount'),
  confirmAddTaskBtn: document.getElementById('confirmAddTaskBtn'),
  cancelAddTaskBtn: document.getElementById('cancelAddTaskBtn'),
  taskQueueList: document.getElementById('taskQueueList'),

  // Header controls & Auth
  authContainer: document.getElementById('authContainer'),
  openAuthModalBtn: document.getElementById('openAuthModalBtn'),
  authBtnText: document.getElementById('authBtnText'),
  userMenuDropdown: document.getElementById('userMenuDropdown'),
  userMenuName: document.getElementById('userMenuName'),
  userMenuEmail: document.getElementById('userMenuEmail'),
  userLogoutBtn: document.getElementById('userLogoutBtn'),

  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundWave: document.getElementById('soundWave'),
  openScienceModalHeaderBtn: document.getElementById('openScienceModalHeaderBtn'),
  openThemeModalBtn: document.getElementById('openThemeModalBtn'),
  openSettingsModalBtn: document.getElementById('openSettingsModalBtn'),

  // Stats & History elements
  statTotalHours: document.getElementById('statTotalHours'),
  statTotalMinutes: document.getElementById('statTotalMinutes'),
  statCompletedCount: document.getElementById('statCompletedCount'),
  statTotalSessions: document.getElementById('statTotalSessions'),
  statTodayMinutes: document.getElementById('statTodayMinutes'),
  statTodaySessions: document.getElementById('statTodaySessions'),
  statStreakDays: document.getElementById('statStreakDays'),
  chartWeekTotal: document.getElementById('chartWeekTotal'),
  activityChart: document.getElementById('activityChart'),
  shareStatsBtn: document.getElementById('shareStatsBtn'),
  historyTableBody: document.getElementById('historyTableBody'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  exportCsvSettingsBtn: document.getElementById('exportCsvSettingsBtn'),

  // Auth modal elements
  authModal: document.getElementById('authModal'),
  closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
  tabLoginBtn: document.getElementById('tabLoginBtn'),
  tabRegisterBtn: document.getElementById('tabRegisterBtn'),
  authSubtext: document.getElementById('authSubtext'),
  authErrorAlert: document.getElementById('authErrorAlert'),
  authForm: document.getElementById('authForm'),
  usernameFieldGroup: document.getElementById('usernameFieldGroup'),
  authUsername: document.getElementById('authUsername'),
  authEmailOrLogin: document.getElementById('authEmailOrLogin'),
  authEmailLabel: document.getElementById('authEmailLabel'),
  authPassword: document.getElementById('authPassword'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),

  // Theme modal elements
  themeModal: document.getElementById('themeModal'),
  closeThemeModalBtn: document.getElementById('closeThemeModalBtn'),
  themePresetsGrid: document.getElementById('themePresetsGrid'),
  customBgColor: document.getElementById('customBgColor'),
  customCardColor: document.getElementById('customCardColor'),
  customAccentColor: document.getElementById('customAccentColor'),
  customTextColor: document.getElementById('customTextColor'),
  customBgHex: document.getElementById('customBgHex'),
  customCardHex: document.getElementById('customCardHex'),
  customAccentHex: document.getElementById('customAccentHex'),
  customTextHex: document.getElementById('customTextHex'),
  applyCustomThemeBtn: document.getElementById('applyCustomThemeBtn'),
  resetDefaultThemeBtn: document.getElementById('resetDefaultThemeBtn'),

  // Settings modal elements
  settingsModal: document.getElementById('settingsModal'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  settingPomodoro: document.getElementById('settingPomodoro'),
  settingShortBreak: document.getElementById('settingShortBreak'),
  settingLongBreak: document.getElementById('settingLongBreak'),
  settingLongBreakInterval: document.getElementById('settingLongBreakInterval'),
  settingAutoStartBreaks: document.getElementById('settingAutoStartBreaks'),
  settingAutoStartPomodoro: document.getElementById('settingAutoStartPomodoro'),
  settingSoundType: document.getElementById('settingSoundType'),
  settingVolume: document.getElementById('settingVolume'),
  volumePercentLabel: document.getElementById('volumePercentLabel'),
  testSoundBtn: document.getElementById('testSoundBtn'),
  requestNotificationBtn: document.getElementById('requestNotificationBtn'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),

  // Science & Guide modal elements
  scienceModal: document.getElementById('scienceModal'),
  openScienceModalFooterBtn: document.getElementById('openScienceModalFooterBtn'),
  startTourBtn: document.getElementById('startTourBtn'),
  closeScienceModalBtn: document.getElementById('closeScienceModalBtn'),
  closeScienceModalBtnBottom: document.getElementById('closeScienceModalBtnBottom'),

  // Feedback modal elements
  feedbackModal: document.getElementById('feedbackModal'),
  openFeedbackModalBtn: document.getElementById('openFeedbackModalBtn'),
  closeFeedbackModalBtn: document.getElementById('closeFeedbackModalBtn'),
  feedbackForm: document.getElementById('feedbackForm'),

  // 4-Pomodoro Guest Sync modal elements
  guestSyncModal: document.getElementById('guestSyncModal'),
  closeGuestSyncModalBtn: document.getElementById('closeGuestSyncModalBtn'),
  guestSyncSignupBtn: document.getElementById('guestSyncSignupBtn'),
  guestSyncDismissBtn: document.getElementById('guestSyncDismissBtn'),

  // Feedback & Canvas
  confettiCanvas: document.getElementById('confettiCanvas'),
  toastContainer: document.getElementById('toastContainer')
};


// ==========================================================================
// 3. Audio Chime Synthesizer (Web Audio API)
// ==========================================================================

function getAudioContext() {
  if (!state.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioCtx();
  }
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
  return state.audioContext;
}

function playChimeSound(type = state.soundType) {
  if (!state.soundEnabled || state.soundVolume <= 0) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(state.soundVolume, now);
    masterGain.connect(ctx.destination);

    if (type === 'zen') {
      const freqs = [216, 432, 648, 864];
      const gains = [0.6, 0.3, 0.15, 0.08];
      
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(gains[idx], now + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now);
        osc.stop(now + 4.0);
      });
    } else if (type === 'bell') {
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.08);

        gain.gain.setValueAtTime(0, now + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.4, now + i * 0.08 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 2.5);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 2.6);
      });
    } else if (type === 'digital') {
      const notes = [587.33, 739.99, 880.00, 1174.66];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.3, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } else if (type === 'marimba') {
      const freqs = [440, 554.37, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0.5, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.8);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.85);
      });
    } else {
      // Classic Beep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.45);
    }
  } catch (err) {
    console.warn('Audio synthesis note:', err);
  }
}


// ==========================================================================
// 4. Confetti Celebration Effect
// ==========================================================================

function triggerConfettiBurst() {
  const canvas = DOM.confettiCanvas;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#4ade80', '#22c55e', '#608066', '#f59e0b', '#00f0ff', '#f472b6', '#a855f7'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.8) * 16 - 2,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      vRotation: (Math.random() - 0.5) * 10
    });
  }

  let animationFrameId;

  function renderConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // Gravity
      p.vx *= 0.98; // Air resistance
      p.rotation += p.vRotation;
      p.alpha -= 0.009;

      if (p.alpha > 0) {
        alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });

    if (alive) {
      animationFrameId = requestAnimationFrame(renderConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      cancelAnimationFrame(animationFrameId);
    }
  }

  renderConfetti();
}


// ==========================================================================
// 5. Timer Mechanics & Display Updates
// ==========================================================================

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calculateSessionEta() {
  if (!DOM.etaText) return;

  const totalCycles = state.longBreakInterval || 4;
  const currentCycle = state.cycleCount || 1;
  const currentMode = state.currentMode || 'pomodoro';
  const remainingCurrentSecs = Math.max(0, state.timeLeft);

  let totalRemainingSecs = remainingCurrentSecs;

  if (currentMode === 'pomodoro') {
    // Remaining subsequent pomodoros in this 4-cycle block
    const remainingSubsequentPomos = Math.max(0, totalCycles - currentCycle);
    // Remaining short breaks in this 4-cycle block
    const remainingShortBreaks = Math.max(0, totalCycles - currentCycle);
    totalRemainingSecs += (remainingSubsequentPomos * state.durations.pomodoro) +
                          (remainingShortBreaks * state.durations.short_break);
  } else if (currentMode === 'short_break') {
    // Current short break is active. Remaining pomodoros to complete the 4-cycle block:
    const remainingPomos = Math.max(0, totalCycles - currentCycle + 1);
    const remainingShortBreaks = Math.max(0, remainingPomos - 1);
    totalRemainingSecs += (remainingPomos * state.durations.pomodoro) +
                          (remainingShortBreaks * state.durations.short_break);
  } else if (currentMode === 'long_break') {
    totalRemainingSecs = remainingCurrentSecs;
  }

  const finishDate = new Date(Date.now() + totalRemainingSecs * 1000);
  const timeStr = finishDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  let remainingStr = '';
  if (totalRemainingSecs >= 3600) {
    const hours = (totalRemainingSecs / 3600).toFixed(1);
    remainingStr = `~${hours}h remaining`;
  } else {
    const mins = Math.max(1, Math.ceil(totalRemainingSecs / 60));
    remainingStr = `~${mins}m remaining`;
  }

  DOM.etaText.innerHTML = `Finish Target: <span class="eta-target">${timeStr}</span> • ${remainingStr}`;
}

function updateTimerDisplay() {
  const formatted = formatTime(state.timeLeft);
  DOM.timeDisplay.textContent = formatted;

  // Dynamic Browser Tab Title formatting:
  // - When running: (MM:SS) PomoHaven (e.g., (24:59) PomoHaven)
  // - When paused/idle: PomoHaven - Cozy & Deep Study Flow
  // - When break active: ☕ Break Time! - PomoHaven (or 🌴 Long Break! - PomoHaven)
  if (state.isRunning) {
    document.title = `(${formatted}) PomoHaven`;
  } else if (state.currentMode === 'short_break' || state.currentMode === 'long_break') {
    document.title = `☕ Break Time! - PomoHaven`;
  } else {
    document.title = `PomoHaven - Cozy & Deep Study Flow`;
  }

  // Update circular SVG progress ring
  if (DOM.progressCircle) {
    const fraction = state.totalDuration > 0 ? (state.timeLeft / state.totalDuration) : 0;
    const offset = CIRCUMFERENCE * (1 - fraction);
    DOM.progressCircle.style.strokeDashoffset = offset;
  }

  // Calculate real-time finish ETA
  calculateSessionEta();
}

function updateStatusBadge() {
  const config = MODE_CONFIG[state.currentMode];
  DOM.statusBadge.textContent = state.isRunning ? config.statusText : config.readyText;
  
  if (state.isRunning) {
    DOM.statusBadge.classList.add('running');
  } else {
    DOM.statusBadge.classList.remove('running');
  }
}

function updateCycleIndicators() {
  DOM.cycleLabel.textContent = `Cycle ${state.cycleCount} of ${state.longBreakInterval}`;
  
  const dots = DOM.cycleIndicator.querySelectorAll('.cycle-dot');
  dots.forEach((dot, idx) => {
    dot.classList.remove('active', 'completed');
    if (idx + 1 < state.cycleCount) {
      dot.classList.add('completed');
    } else if (idx + 1 === state.cycleCount) {
      dot.classList.add('active');
    }
  });

  calculateSessionEta();
}

function updateModeTabs() {
  const modes = ['pomodoro', 'short_break', 'long_break'];
  modes.forEach(mode => {
    const tab = DOM['tab' + mode.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')];
    if (tab) {
      tab.classList.toggle('active', state.currentMode === mode);
    }
  });
}

function updateModeTabsDisabledState(disabled) {
  const tabs = [DOM.tabPomodoro, DOM.tabShortBreak, DOM.tabLongBreak];
  tabs.forEach(tab => {
    if (!tab) return;
    tab.disabled = disabled;
    if (disabled) {
      tab.classList.add('disabled-mode-switch');
      tab.setAttribute('title', 'Pause or reset timer to switch modes');
    } else {
      tab.classList.remove('disabled-mode-switch');
      tab.removeAttribute('title');
    }
  });
}

function switchMode(newMode, autoStart = false) {
  if (state.isRunning) {
    pauseTimer();
  }

  state.currentMode = newMode;
  state.totalDuration = state.durations[newMode];
  state.timeLeft = state.totalDuration;
  state.sessionStartTime = null;

  updateModeTabs();
  updateModeTabsDisabledState(false);
  updateTimerDisplay();
  updateStatusBadge();

  if (autoStart) {
    startTimer();
  }
}

function startTimer() {
  if (state.isRunning) return;

  state.isRunning = true;
  state.sessionStartTime = new Date().toISOString();

  // Switch play/pause icon & text
  DOM.playIcon.style.display = 'none';
  DOM.pauseIcon.style.display = 'inline-block';
  DOM.startPauseText.textContent = 'Pause';
  DOM.startPauseBtn.classList.add('running');

  // Disable mode tabs while timer is running
  updateModeTabsDisabledState(true);
  updateStatusBadge();

  // Drift-free interval timer based on real timestamps
  const expectedEnd = Date.now() + state.timeLeft * 1000;

  state.timerInterval = setInterval(() => {
    const remainingMs = expectedEnd - Date.now();
    const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));

    state.timeLeft = remainingSecs;
    updateTimerDisplay();

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      handleTimerComplete();
    }
  }, 250);
}

function pauseTimer() {
  if (!state.isRunning) return;

  state.isRunning = false;
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  DOM.playIcon.style.display = 'inline-block';
  DOM.pauseIcon.style.display = 'none';
  DOM.startPauseText.textContent = 'Start';
  DOM.startPauseBtn.classList.remove('running');

  // Re-enable mode tabs when timer is paused
  updateModeTabsDisabledState(false);
  updateStatusBadge();
}

function toggleStartPause() {
  if (state.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function resetTimer() {
  const wasRunning = state.isRunning;
  pauseTimer();

  state.timeLeft = state.totalDuration;
  state.sessionStartTime = null;
  updateModeTabsDisabledState(false);
  updateTimerDisplay();
  updateStatusBadge();

  if (wasRunning) {
    showToast('Timer reset', 'info');
  }
}

function skipSession() {
  const previousMode = state.currentMode;
  pauseTimer();

  // Log skipped session if had ran partially
  if (state.sessionStartTime && (state.totalDuration - state.timeLeft) > 10) {
    const durationMins = Math.round(((state.totalDuration - state.timeLeft) / 60) * 10) / 10;
    recordSession({
      mode: previousMode,
      duration_minutes: durationMins,
      start_time: state.sessionStartTime,
      end_time: new Date().toISOString(),
      status: 'skipped',
      task_name: state.currentTask || 'Study Session'
    });
  }

  transitionToNextMode(false);
  showToast(`Skipped ${MODE_CONFIG[previousMode].title}`, 'info');
}

async function handleTimerComplete() {
  pauseTimer();
  const completedMode = state.currentMode;
  const durationMins = Math.round((state.totalDuration / 60) * 10) / 10;
  const startTime = state.sessionStartTime || new Date(Date.now() - state.totalDuration * 1000).toISOString();
  const endTime = new Date().toISOString();

  // 1. Play audio chime
  playChimeSound();

  // 2. Desktop notification
  showDesktopNotification(completedMode);

  // 3. Record session in SQLite database & localStorage
  await recordSession({
    mode: completedMode,
    duration_minutes: durationMins,
    start_time: startTime,
    end_time: endTime,
    status: 'completed',
    task_name: state.currentTask || (completedMode === 'pomodoro' ? 'Focus Session' : 'Break Time')
  });

  // 4. Confetti & Celebration for completed pomodoro
  if (completedMode === 'pomodoro') {
    triggerConfettiBurst();
    showToast(`🎉 Great job! Completed ${durationMins}m focus session.`, 'success');
    
    // Automatically increment multi-task queue target progress
    if (typeof incrementActiveTaskProgress === 'function') {
      incrementActiveTaskProgress();
    }

    checkGuestSyncPrompt();
  } else {
    showToast(`⚡ Break finished! Ready for another round?`, 'info');
  }

  // 5. Refresh analytics
  await fetchStatistics();

  // 6. Transition to the next cycle mode
  transitionToNextMode(true);
}

function transitionToNextMode(isNaturalCompletion = true) {
  if (state.currentMode === 'pomodoro') {
    if (state.cycleCount >= state.longBreakInterval) {
      state.cycleCount = 1;
      updateCycleIndicators();
      switchMode('long_break', isNaturalCompletion && state.autoStartBreaks);
    } else {
      state.cycleCount++;
      updateCycleIndicators();
      switchMode('short_break', isNaturalCompletion && state.autoStartBreaks);
    }
  } else {
    switchMode('pomodoro', isNaturalCompletion && state.autoStartPomodoro);
  }
}


// ==========================================================================
// 6. Hybrid Persistence & Local Storage Engine
// ==========================================================================

function getLocalSessions() {
  try {
    return JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY_SESSIONS) ||
      localStorage.getItem('pomoclock_local_sessions') ||
      localStorage.getItem('focusflow_local_sessions') ||
      localStorage.getItem('focusflow_sessions') ||
      '[]'
    );
  } catch (e) {
    return [];
  }
}

function saveLocalSession(sessionItem) {
  try {
    const sessions = getLocalSessions();
    sessions.unshift(sessionItem);
    if (sessions.length > 300) sessions.length = 300;
    localStorage.setItem(LOCAL_STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  } catch (e) {
    console.error('Failed to save session locally:', e);
  }
}

function clearLocalSessions() {
  localStorage.removeItem(LOCAL_STORAGE_KEY_SESSIONS);
}

function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getSessionLocalDateString(startTimeStr) {
  if (!startTimeStr) return '';
  try {
    const d = new Date(startTimeStr);
    if (isNaN(d.getTime())) return startTimeStr.split('T')[0];
    return getLocalDateString(d);
  } catch (e) {
    return startTimeStr.split('T')[0];
  }
}

function computeLocalStats() {
  const sessions = getLocalSessions();
  const completedPomodoros = sessions.filter(s => s.mode === 'pomodoro' && s.status === 'completed');
  const totalFocusMinutes = completedPomodoros.reduce((acc, s) => acc + (parseFloat(s.duration_minutes) || 0), 0);
  const totalFocusHours = Math.round((totalFocusMinutes / 60) * 100) / 100;
  const totalSessions = sessions.length;

  const todayStr = getLocalDateString();
  const todayPomodoros = completedPomodoros.filter(s => getSessionLocalDateString(s.start_time) === todayStr);
  const todayFocusMinutes = todayPomodoros.reduce((acc, s) => acc + (parseFloat(s.duration_minutes) || 0), 0);

  // 7-day activity
  const weeklyActivity = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = getLocalDateString(d);
    const dayName = d.toLocaleDateString([], { weekday: 'short' });

    const daySessions = completedPomodoros.filter(s => getSessionLocalDateString(s.start_time) === dayStr);
    const dayMinutes = daySessions.reduce((acc, s) => acc + (parseFloat(s.duration_minutes) || 0), 0);

    weeklyActivity.push({
      date: dayStr,
      day_name: dayName,
      focus_minutes: Math.round(dayMinutes * 10) / 10,
      completed_count: daySessions.length
    });
  }

  // Streak calculation
  let streakDays = 0;
  const todayActive = todayPomodoros.length > 0;
  if (todayActive) streakDays = 1;
  let offset = 1;
  while (true) {
    const pd = new Date(now);
    pd.setDate(pd.getDate() - offset);
    const pdStr = getLocalDateString(pd);
    const hasDay = completedPomodoros.some(s => getSessionLocalDateString(s.start_time) === pdStr);
    if (hasDay) {
      streakDays++;
      offset++;
    } else {
      break;
    }
    if (offset > 365) break;
  }

  return {
    total_focus_minutes: Math.round(totalFocusMinutes * 10) / 10,
    total_focus_hours: totalFocusHours,
    completed_pomodoros: completedPomodoros.length,
    total_sessions: totalSessions,
    today_focus_minutes: Math.round(todayFocusMinutes * 10) / 10,
    today_pomodoros: todayPomodoros.length,
    current_streak_days: streakDays,
    weekly_activity: weeklyActivity,
    recent_sessions: sessions.slice(0, 10)
  };
}

async function syncLocalSessionsWithServer() {
  const localSessions = getLocalSessions();
  if (!localSessions.length) return;

  try {
    const res = await fetch('/api/sessions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: localSessions })
    });
    const data = await res.json();
    if (data.success && data.synced_count > 0) {
      console.log(`Synced ${data.synced_count} local sessions to server.`);
    }
  } catch (e) {
    console.warn('Could not sync local sessions to server:', e);
  }
}


// ==========================================================================
// 7. REST API Client & Statistics Rendering
// ==========================================================================

async function recordSession(payload) {
  // 1. Store in localStorage immediately for 100% hybrid persistence
  saveLocalSession(payload);

  // 2. Instantly update UI statistics & chart locally
  const localStats = computeLocalStats();
  renderStatistics(localStats);

  // 3. Attempt server sync
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('Backend unavailable; session preserved safely in local storage.');
    return { success: true, local_only: true };
  }
}

async function fetchStatistics() {
  // 1. Instantly render from local storage for 0ms initial load
  const localStats = computeLocalStats();
  renderStatistics(localStats);

  // 2. Fetch authoritative database statistics if available
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();

    if (result.success && result.stats) {
      renderStatistics(result.stats);
      return;
    }
  } catch (err) {
    console.warn('Backend stats unavailable, using local calculation fallback:', err);
  }
}

function renderStatistics(stats) {
  DOM.statTotalHours.innerHTML = `${stats.total_focus_hours} <small>hrs</small>`;
  DOM.statTotalMinutes.textContent = `${stats.total_focus_minutes} mins recorded`;
  DOM.statCompletedCount.textContent = stats.completed_pomodoros;
  DOM.statTotalSessions.textContent = `${stats.total_sessions} total sessions`;
  DOM.statTodayMinutes.innerHTML = `${stats.today_focus_minutes} <small>min</small>`;
  DOM.statTodaySessions.textContent = `${stats.today_pomodoros} sessions today`;
  DOM.statStreakDays.innerHTML = `${stats.current_streak_days} <small>days</small>`;

  const weekTotalMins = (stats.weekly_activity || []).reduce((acc, d) => acc + (d.focus_minutes || 0), 0);
  DOM.chartWeekTotal.textContent = `${(weekTotalMins / 60).toFixed(1)}h this week`;

  renderWeeklyChart(stats.weekly_activity || []);
  renderRecentSessions(stats.recent_sessions || []);
}

function renderWeeklyChart(activity) {
  if (!DOM.activityChart) return;

  if (!activity.length) {
    DOM.activityChart.innerHTML = `<div class="chart-loading">No activity recorded this week</div>`;
    return;
  }

  const recordedMins = activity.map(a => parseFloat(a.focus_minutes) || 0);
  const maxMinutes = Math.max(...recordedMins, 25);
  const todayStr = getLocalDateString();

  let html = '';
  activity.forEach(item => {
    const mins = parseFloat(item.focus_minutes) || 0;
    const isToday = item.date === todayStr;
    let heightPercent = 0;
    let minHeightPx = '0px';
    let barOpacity = 0.25;

    if (mins > 0) {
      // Smart visual minimum fill so any logged session (even 1m) shows a clear active indicator
      const rawPercent = (mins / maxMinutes) * 100;
      heightPercent = Math.min(100, Math.max(8, Math.round(rawPercent)));
      minHeightPx = '8px';
      barOpacity = 1;
    }

    html += `
      <div class="chart-col ${isToday ? 'today' : ''}">
        <div class="chart-tooltip">${mins} mins (${item.completed_count || 0} 🍅)</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height: ${heightPercent}%; min-height: ${minHeightPx}; opacity: ${barOpacity};"></div>
        </div>
        <span class="chart-day-label">${item.day_name}</span>
      </div>
    `;
  });

  DOM.activityChart.innerHTML = html;
}

function renderRecentSessions(sessions) {
  if (!DOM.historyTableBody) return;

  if (!sessions || sessions.length === 0) {
    DOM.historyTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">No sessions recorded yet. Complete a timer to view logs!</td>
      </tr>
    `;
    return;
  }

  let html = '';
  sessions.forEach(s => {
    let modeLabel = 'Focus';
    if (s.mode === 'short_break') modeLabel = 'Short Break';
    if (s.mode === 'long_break') modeLabel = 'Long Break';

    let formattedTime = 'Just now';
    try {
      const d = new Date(s.start_time);
      formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                      ' (' + (d.getMonth() + 1) + '/' + d.getDate() + ')';
    } catch (e) {
      formattedTime = s.start_time;
    }

    html += `
      <tr>
        <td><strong>${modeLabel}</strong></td>
        <td>${escapeHtml(s.task_name || 'Study Session')}</td>
        <td>${s.duration_minutes}m</td>
        <td><span class="status-badge ${s.status}">${s.status}</span></td>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${formattedTime}</td>
      </tr>
    `;
  });

  DOM.historyTableBody.innerHTML = html;
}

async function handleClearHistory() {
  if (!confirm('Are you sure you want to clear all study logs and reset stats?')) return;

  clearLocalSessions();

  try {
    await fetch('/api/sessions', { method: 'DELETE' });
  } catch (err) {
    console.warn('Backend clear failed, local history already cleared:', err);
  }

  await fetchStatistics();
  showToast('Study history cleared', 'info');
}

async function syncPreferences(prefsObj) {
  try {
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefsObj)
    });
  } catch (err) {
    console.warn('Could not sync preferences to backend:', err);
  }
}


// ==========================================================================
// 8. User Authentication Module (Google OAuth 2.0 & Email/Password)
// ==========================================================================

let googleSignInRetryCount = 0;

function initGoogleSignIn() {
  const clientId = (
    window.GOOGLE_CLIENT_ID ||
    (window.POMOHAVEN_CONFIG && window.POMOHAVEN_CONFIG.googleClientId) ||
    (window.POMOCLOCK_CONFIG && window.POMOCLOCK_CONFIG.googleClientId) ||
    ''
  ).trim();

  const googleBtnContainer = document.getElementById('googleSignInBtn');
  if (!googleBtnContainer) return;

  if (window.google && window.google.accounts && window.google.accounts.id) {
    try {
      if (clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        googleBtnContainer.innerHTML = '';
        window.google.accounts.id.renderButton(
          googleBtnContainer,
          {
            theme: 'filled_black',
            size: 'large',
            text: 'continue_with',
            shape: 'pill',
            width: 320,
            logo_alignment: 'left'
          }
        );
      } else {
        googleBtnContainer.innerHTML = `
          <button type="button" class="modal-btn secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.6rem; border-radius: var(--radius-full); padding: 0.65rem 1rem;" id="googleDemoBtn">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#EA4335" d="M12 5c1.7 0 3 .7 3.9 1.5l2.9-2.9C17 1.9 14.7 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.6 2.8C6.4 7.2 8.9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
              <path fill="#FBBC05" d="M5.5 14.1c-.2-.7-.4-1.4-.4-2.1s.2-1.4.4-2.1L1.9 7.1C.7 9.5 0 10.7 0 12s.7 2.5 1.9 4.9l3.6-2.8z"/>
              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.6-2.2-6.5-5.1L1.9 16C3.7 19.7 7.5 23 12 23z"/>
            </svg>
            <span style="font-size: 0.85rem; font-weight: 600;">Sign in with Google</span>
          </button>
        `;
        const demoBtn = document.getElementById('googleDemoBtn');
        if (demoBtn) {
          demoBtn.addEventListener('click', () => {
            showToast('Configure GOOGLE_CLIENT_ID in .env to activate live Google login', 'info');
          });
        }
      }
    } catch (err) {
      console.warn('Google Identity Services initialization warning:', err);
    }
  } else {
    // If Google Client library is still loading, retry
    if (googleSignInRetryCount < 10) {
      googleSignInRetryCount++;
      setTimeout(initGoogleSignIn, 300);
    }
  }
}

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    showToast('Google Sign-In failed or was cancelled.', 'error');
    return;
  }

  DOM.authErrorAlert.style.display = 'none';

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();

    if (!data.success) {
      DOM.authErrorAlert.textContent = data.error || 'Google authentication failed';
      DOM.authErrorAlert.style.display = 'block';
      return;
    }

    state.currentUser = data.user;
    updateAuthUI();
    closeModal(DOM.authModal);
    showToast(`Welcome, ${data.user.name || data.user.email}! Google Cloud Sync active ✨`, 'success');

    // Auto-sync guest sessions to account
    await syncLocalSessionsWithServer();
    await fetchStatistics();
  } catch (err) {
    DOM.authErrorAlert.textContent = 'Network error during Google sign-in';
    DOM.authErrorAlert.style.display = 'block';
  }
}

async function syncLocalSessionsWithServer() {
  const localSessions = getLocalSessions();
  if (!localSessions || localSessions.length === 0) return;

  try {
    const res = await fetch('/api/sessions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions: localSessions })
    });
    const data = await res.json();
    if (data.success && data.synced_count > 0) {
      showToast(`Synced ${data.synced_count} offline sessions to your cloud profile!`, 'success');
    }
  } catch (err) {
    console.warn('Could not sync local sessions:', err);
  }
}

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated && data.user) {
      state.currentUser = data.user;
    } else {
      state.currentUser = null;
    }
  } catch (e) {
    state.currentUser = null;
  }
  updateAuthUI();
}

function updateAuthUI() {
  if (!DOM.openAuthModalBtn) return;

  if (state.currentUser) {
    const displayName = state.currentUser.name || state.currentUser.username || state.currentUser.email.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();
    const avatarUrl = state.currentUser.avatar_url;

    if (avatarUrl) {
      DOM.openAuthModalBtn.innerHTML = `
        <span class="auth-avatar-pill">
          <img src="${escapeHtml(avatarUrl)}" class="avatar-img-round" alt="Avatar" referrerpolicy="no-referrer">
        </span>
        <span class="header-btn-text">${escapeHtml(displayName)}</span>
      `;
    } else {
      DOM.openAuthModalBtn.innerHTML = `
        <span class="auth-avatar-pill">
          <span class="avatar-initials-badge">${initial}</span>
        </span>
        <span class="header-btn-text">${escapeHtml(displayName)}</span>
      `;
    }

    DOM.openAuthModalBtn.title = `Logged in as ${displayName} (${state.currentUser.email})`;
    if (DOM.userMenuName) DOM.userMenuName.textContent = displayName;
    if (DOM.userMenuEmail) DOM.userMenuEmail.textContent = state.currentUser.email;

    const dropdownAvatarImg = document.getElementById('dropdownAvatarImg');
    const dropdownAvatarInitials = document.getElementById('dropdownAvatarInitials');
    if (dropdownAvatarImg && dropdownAvatarInitials) {
      if (avatarUrl) {
        dropdownAvatarImg.src = avatarUrl;
        dropdownAvatarImg.classList.remove('hidden');
        dropdownAvatarInitials.classList.add('hidden');
      } else {
        dropdownAvatarInitials.textContent = initial;
        dropdownAvatarInitials.classList.remove('hidden');
        dropdownAvatarImg.classList.add('hidden');
      }
    }
  } else {
    DOM.openAuthModalBtn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      <span class="header-btn-text">Sign In / Sync</span>
    `;
    DOM.openAuthModalBtn.title = "Sign in to sync across devices (Optional)";
    if (DOM.userMenuDropdown) DOM.userMenuDropdown.style.display = 'none';
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  DOM.authErrorAlert.style.display = 'none';

  if (mode === 'register') {
    DOM.tabRegisterBtn.classList.add('active');
    DOM.tabLoginBtn.classList.remove('active');
    DOM.usernameFieldGroup.style.display = 'block';
    DOM.authUsername.required = true;
    DOM.authEmailLabel.textContent = 'Email Address';
    DOM.authEmailOrLogin.type = 'email';
    DOM.authEmailOrLogin.placeholder = 'alex@university.edu';
    DOM.authSubmitBtn.textContent = 'Create Account & Sync';
    DOM.authSubtext.textContent = 'Create a free account to sync your study streaks and stats seamlessly across multiple devices.';
  } else {
    DOM.tabLoginBtn.classList.add('active');
    DOM.tabRegisterBtn.classList.remove('active');
    DOM.usernameFieldGroup.style.display = 'none';
    DOM.authUsername.required = false;
    DOM.authEmailLabel.textContent = 'Email Address';
    DOM.authEmailOrLogin.type = 'text';
    DOM.authEmailOrLogin.placeholder = 'alex@university.edu';
    DOM.authSubmitBtn.textContent = 'Sign In';
    DOM.authSubtext.textContent = 'Sign in to sync your study streaks and stats across multiple devices. (Optional — Guest data stays saved locally).';
  }
}

async function handleAuthFormSubmit() {
  DOM.authErrorAlert.style.display = 'none';
  const emailOrLogin = DOM.authEmailOrLogin.value.trim();
  const password = DOM.authPassword.value;
  const name = DOM.authUsername.value.trim();

  DOM.authSubmitBtn.disabled = true;
  DOM.authSubmitBtn.textContent = 'Please wait...';

  try {
    let endpoint = '/api/auth/login';
    let payload = { email: emailOrLogin, login: emailOrLogin, password };

    if (state.authMode === 'register') {
      endpoint = '/api/auth/register';
      payload = { name, username: name, email: emailOrLogin, password };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      DOM.authErrorAlert.textContent = data.error || 'Authentication failed. Please try again.';
      DOM.authErrorAlert.style.display = 'block';
      DOM.authSubmitBtn.disabled = false;
      DOM.authSubmitBtn.textContent = state.authMode === 'register' ? 'Create Account & Sync' : 'Sign In';
      return;
    }

    state.currentUser = data.user;
    updateAuthUI();
    closeModal(DOM.authModal);
    DOM.authForm.reset();

    const welcomeName = data.user.name || data.user.username || data.user.email;
    showToast(`Welcome, ${welcomeName}! Syncing sessions...`, 'success');

    // Auto-sync guest sessions to account
    await syncLocalSessionsWithServer();
    await fetchStatistics();

  } catch (err) {
    DOM.authErrorAlert.textContent = 'Network error. Please check your connection.';
    DOM.authErrorAlert.style.display = 'block';
  } finally {
    DOM.authSubmitBtn.disabled = false;
    DOM.authSubmitBtn.textContent = state.authMode === 'register' ? 'Create Account & Sync' : 'Sign In';
  }
}

async function handleUserLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    state.currentUser = null;
    updateAuthUI();
    if (DOM.userMenuDropdown) DOM.userMenuDropdown.style.display = 'none';
    showToast('Logged out. Switched to Guest Mode.', 'info');
    await fetchStatistics();
  } catch (e) {
    console.error('Logout error:', e);
  }
}


// ==========================================================================
// 9. Theme Engine & Custom Color System
// ==========================================================================

const THEME_PRESETS = {
  pomodoro: { bg: '#1A1212', card: '#2A181A', accent: '#E05344', text: '#FFF5F5', rgb: '224, 83, 68' },
  matcha: { bg: '#18221b', card: '#223027', accent: '#4ade80', text: '#f0fdf4', rgb: '74, 222, 128' },
  coffee: { bg: '#1e1713', card: '#2d221c', accent: '#f59e0b', text: '#fef3c7', rgb: '245, 158, 11' },
  cyberpunk: { bg: '#090a10', card: '#141724', accent: '#00f0ff', text: '#f8fafc', rgb: '0, 240, 255' },
  midnight: { bg: '#000000', card: '#14141c', accent: '#6366f1', text: '#ffffff', rgb: '99, 102, 241' },
  sakura: { bg: '#23161c', card: '#34202a', accent: '#f472b6', text: '#fff1f2', rgb: '244, 114, 182' },
  sunset: { bg: '#120d1c', card: '#241834', accent: '#fb923c', text: '#fff7ed', rgb: '251, 146, 60' },
  sage: { bg: '#F4F7F4', card: '#FFFFFF', accent: '#608066', text: '#2D3748', rgb: '96, 128, 102' },
  blush: { bg: '#FAF5F5', card: '#FFFFFF', accent: '#C07D88', text: '#3B2E31', rgb: '192, 125, 136' },
  cerulean: { bg: '#F0F4F8', card: '#FFFFFF', accent: '#5B82A6', text: '#253342', rgb: '91, 130, 166' }
};

function hexToRgbValues(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return '224, 83, 68';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function applyTheme(themeName, customColors = null, save = true) {
  state.theme = themeName;
  document.body.setAttribute('data-theme', themeName);

  document.querySelectorAll('.theme-card-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-preset') === themeName);
  });

  if (themeName === 'custom' && customColors) {
    state.customColors = { ...customColors };
    const rgbStr = hexToRgbValues(customColors.accent);
    document.documentElement.style.setProperty('--bg-primary', customColors.bg);
    document.documentElement.style.setProperty('--bg-secondary', adjustColorBrightness(customColors.bg, 10));
    document.documentElement.style.setProperty('--bg-card', hexToRgba(customColors.card, 0.9));
    document.documentElement.style.setProperty('--bg-card-hover', customColors.card);
    document.documentElement.style.setProperty('--accent-color', customColors.accent);
    document.documentElement.style.setProperty('--accent-secondary', adjustColorBrightness(customColors.accent, -15));
    document.documentElement.style.setProperty('--accent-rgb', rgbStr);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${rgbStr}, 0.22)`);
    document.documentElement.style.setProperty('--card-border', `rgba(${rgbStr}, 0.18)`);
    document.documentElement.style.setProperty('--border-color', `rgba(${rgbStr}, 0.18)`);
    document.documentElement.style.setProperty('--border-hover', `rgba(${rgbStr}, 0.38)`);
    document.documentElement.style.setProperty('--badge-bg', `rgba(${rgbStr}, 0.12)`);
    document.documentElement.style.setProperty('--text-primary', customColors.text);
    document.documentElement.style.setProperty('--text-secondary', hexToRgba(customColors.text, 0.85));
    document.documentElement.style.setProperty('--text-muted', hexToRgba(customColors.text, 0.65));

    DOM.customBgColor.value = customColors.bg;
    DOM.customCardColor.value = customColors.card;
    DOM.customAccentColor.value = customColors.accent;
    DOM.customTextColor.value = customColors.text;
    updateHexLabels();
  } else {
    [
      '--bg-primary', '--bg-secondary', '--bg-card', '--bg-card-hover',
      '--accent-color', '--accent-secondary', '--accent-rgb', '--accent-glow',
      '--card-border', '--border-color', '--border-hover', '--badge-bg',
      '--text-primary', '--text-secondary', '--text-muted'
    ].forEach(prop => document.documentElement.style.removeProperty(prop));

    const preset = THEME_PRESETS[themeName] || THEME_PRESETS.pomodoro;
    if (preset.rgb) {
      document.documentElement.style.setProperty('--accent-rgb', preset.rgb);
    }
    DOM.customBgColor.value = preset.bg;
    DOM.customCardColor.value = preset.card;
    DOM.customAccentColor.value = preset.accent;
    DOM.customTextColor.value = preset.text;
    updateHexLabels();
  }

  if (save) {
    localStorage.setItem('pomohaven_theme', themeName);
    localStorage.setItem('pomoclock_theme', themeName);
    if (customColors) {
      localStorage.setItem('pomohaven_custom_colors', JSON.stringify(customColors));
    }
    syncPreferences({ theme: themeName });
  }
}

function updateHexLabels() {
  DOM.customBgHex.textContent = DOM.customBgColor.value.toUpperCase();
  DOM.customCardHex.textContent = DOM.customCardColor.value.toUpperCase();
  DOM.customAccentHex.textContent = DOM.customAccentColor.value.toUpperCase();
  DOM.customTextHex.textContent = DOM.customTextColor.value.toUpperCase();
}


// ==========================================================================
// 10. Notification & Toast Engine
// ==========================================================================

function showToast(message, type = 'info') {
  const container = DOM.toastContainer;
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.25s forwards';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported by browser', 'error');
    return;
  }

  if (Notification.permission === 'granted') {
    showToast('Notifications already active!', 'success');
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showToast('Notifications enabled!', 'success');
      } else {
        showToast('Notifications disabled', 'info');
      }
    });
  } else {
    showToast('Notification permission denied in browser settings', 'error');
  }
}

function showDesktopNotification(mode) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const config = MODE_CONFIG[mode];
  const title = mode === 'pomodoro' ? '🍅 Focus Session Complete!' : '☕ Break Finished!';
  const body = mode === 'pomodoro' ? 'Great work! Take a well-deserved break.' : 'Time to dive back into deep focus.';

  try {
    new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍅</text></svg>'
    });
  } catch (err) {
    console.warn('Desktop notification error:', err);
  }
}


// ==========================================================================
// 11. Settings & Preferences Management
// ==========================================================================

function updateModeBadges(pomoSeconds, shortBreakSeconds, longBreakSeconds) {
  const pomoMins = Math.round((pomoSeconds !== undefined ? pomoSeconds : state.durations.pomodoro) / 60);
  const shortMins = Math.round((shortBreakSeconds !== undefined ? shortBreakSeconds : state.durations.short_break) / 60);
  const longMins = Math.round((longBreakSeconds !== undefined ? longBreakSeconds : state.durations.long_break) / 60);

  if (DOM.badgePomodoro) DOM.badgePomodoro.textContent = `${pomoMins}m`;
  if (DOM.badgeShortBreak) DOM.badgeShortBreak.textContent = `${shortMins}m`;
  if (DOM.badgeLongBreak) DOM.badgeLongBreak.textContent = `${longMins}m`;
}

function loadStoredSettings() {
  const savedTheme = localStorage.getItem('pomohaven_theme') || localStorage.getItem('pomoclock_theme') || localStorage.getItem('focusflow_theme') || 'pomodoro';
  const savedCustom = localStorage.getItem('pomohaven_custom_colors') || localStorage.getItem('pomoclock_custom_colors') || localStorage.getItem('focusflow_custom_colors');
  if (savedTheme === 'custom' && savedCustom) {
    applyTheme('custom', JSON.parse(savedCustom), false);
  } else {
    applyTheme(savedTheme, null, false);
  }

  const savedPomo = parseInt(localStorage.getItem('pomohaven_dur_pomo') || localStorage.getItem('pomoclock_dur_pomo') || localStorage.getItem('focusflow_dur_pomo'), 10);
  const savedShort = parseInt(localStorage.getItem('pomohaven_dur_short') || localStorage.getItem('pomoclock_dur_short') || localStorage.getItem('focusflow_dur_short'), 10);
  const savedLong = parseInt(localStorage.getItem('pomohaven_dur_long') || localStorage.getItem('pomoclock_dur_long') || localStorage.getItem('focusflow_dur_long'), 10);
  const savedInterval = parseInt(localStorage.getItem('pomohaven_cycle_interval') || localStorage.getItem('pomoclock_cycle_interval') || localStorage.getItem('focusflow_cycle_interval'), 10);
  const savedAutoBreaks = (localStorage.getItem('pomohaven_auto_breaks') || localStorage.getItem('pomoclock_auto_breaks') || localStorage.getItem('focusflow_auto_breaks')) === 'true';
  const savedAutoPomo = (localStorage.getItem('pomohaven_auto_pomo') || localStorage.getItem('pomoclock_auto_pomo') || localStorage.getItem('focusflow_auto_pomo')) === 'true';
  const savedSound = localStorage.getItem('pomohaven_sound_type') || localStorage.getItem('pomoclock_sound_type') || localStorage.getItem('focusflow_sound_type') || 'zen';
  const savedVolume = parseFloat(localStorage.getItem('pomohaven_sound_volume') || localStorage.getItem('pomoclock_sound_volume') || localStorage.getItem('focusflow_sound_volume'));

  if (!isNaN(savedPomo) && savedPomo > 0) state.durations.pomodoro = savedPomo * 60;
  if (!isNaN(savedShort) && savedShort > 0) state.durations.short_break = savedShort * 60;
  if (!isNaN(savedLong) && savedLong > 0) state.durations.long_break = savedLong * 60;
  if (!isNaN(savedInterval) && savedInterval >= 2) state.longBreakInterval = savedInterval;
  state.autoStartBreaks = savedAutoBreaks;
  state.autoStartPomodoro = savedAutoPomo;
  state.soundType = savedSound;
  if (!isNaN(savedVolume)) state.soundVolume = savedVolume;

  state.totalDuration = state.durations[state.currentMode];
  state.timeLeft = state.totalDuration;

  DOM.settingPomodoro.value = Math.round(state.durations.pomodoro / 60);
  DOM.settingShortBreak.value = Math.round(state.durations.short_break / 60);
  DOM.settingLongBreak.value = Math.round(state.durations.long_break / 60);
  DOM.settingLongBreakInterval.value = state.longBreakInterval;
  DOM.settingAutoStartBreaks.checked = state.autoStartBreaks;
  DOM.settingAutoStartPomodoro.checked = state.autoStartPomodoro;
  DOM.settingSoundType.value = state.soundType;
  DOM.settingVolume.value = Math.round(state.soundVolume * 100);
  DOM.volumePercentLabel.textContent = `${Math.round(state.soundVolume * 100)}%`;

  // Dynamically update mode badges from loaded settings
  updateModeBadges();
}

function saveSettingsFromModal() {
  const pomoMins = parseInt(DOM.settingPomodoro.value, 10);
  const shortMins = parseInt(DOM.settingShortBreak.value, 10);
  const longMins = parseInt(DOM.settingLongBreak.value, 10);
  const interval = parseInt(DOM.settingLongBreakInterval.value, 10);

  if (pomoMins > 0) {
    state.durations.pomodoro = pomoMins * 60;
    localStorage.setItem('pomohaven_dur_pomo', pomoMins);
  }
  if (shortMins > 0) {
    state.durations.short_break = shortMins * 60;
    localStorage.setItem('pomohaven_dur_short', shortMins);
  }
  if (longMins > 0) {
    state.durations.long_break = longMins * 60;
    localStorage.setItem('pomohaven_dur_long', longMins);
  }
  if (interval >= 2) {
    state.longBreakInterval = interval;
    localStorage.setItem('pomohaven_cycle_interval', interval);
  }

  state.autoStartBreaks = DOM.settingAutoStartBreaks.checked;
  state.autoStartPomodoro = DOM.settingAutoStartPomodoro.checked;
  state.soundType = DOM.settingSoundType.value;
  state.soundVolume = parseInt(DOM.settingVolume.value, 10) / 100;

  localStorage.setItem('pomohaven_auto_breaks', state.autoStartBreaks);
  localStorage.setItem('pomohaven_auto_pomo', state.autoStartPomodoro);
  localStorage.setItem('pomohaven_sound_type', state.soundType);
  localStorage.setItem('pomohaven_sound_volume', state.soundVolume);

  if (!state.isRunning) {
    state.totalDuration = state.durations[state.currentMode];
    state.timeLeft = state.totalDuration;
    updateTimerDisplay();
  }

  // Update mode badges with newly saved durations
  updateModeBadges();
  updateCycleIndicators();
  closeModal(DOM.settingsModal);
  showToast('Settings saved successfully', 'success');

  syncPreferences({
    pomodoro_duration: pomoMins,
    short_break_duration: shortMins,
    long_break_duration: longMins,
    sound_type: state.soundType
  });
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (modal === DOM.authModal) {
    initGoogleSignIn();
  }
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}


// ==========================================================================
// 12. Helper Utilities
// ==========================================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function hexToRgba(hex, alpha = 1) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function adjustColorBrightness(hex, percent) {
  let num = parseInt(hex.replace('#', ''), 16);
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let G = (num >> 8 & 0x00FF) + amt;
  let B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
}


// ==========================================================================
// 13. Event Listeners Setup
// ==========================================================================

function setupEventListeners() {
  // Timer Controls
  DOM.startPauseBtn.addEventListener('click', toggleStartPause);
  DOM.resetBtn.addEventListener('click', resetTimer);
  DOM.skipBtn.addEventListener('click', skipSession);
  if (DOM.zenModeBtn) {
    DOM.zenModeBtn.addEventListener('click', () => toggleZenMode());
  }

  // Mode Selection Tabs
  DOM.tabPomodoro.addEventListener('click', () => switchMode('pomodoro'));
  DOM.tabShortBreak.addEventListener('click', () => switchMode('short_break'));
  DOM.tabLongBreak.addEventListener('click', () => switchMode('long_break'));

  // Task Input
  DOM.currentTaskInput.addEventListener('input', (e) => {
    state.currentTask = e.target.value.trim();
    if (typeof renderTaskQueue === 'function') {
      renderTaskQueue();
    }
  });
  DOM.clearTaskBtn.addEventListener('click', () => {
    DOM.currentTaskInput.value = '';
    state.currentTask = '';
    DOM.currentTaskInput.focus();
    if (typeof renderTaskQueue === 'function') {
      renderTaskQueue();
    }
  });

  // Sound Toggle (Mute / Unmute)
  DOM.soundToggleBtn.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    DOM.soundToggleBtn.style.opacity = state.soundEnabled ? '1' : '0.4';
    DOM.soundWave.style.display = state.soundEnabled ? 'block' : 'none';
    showToast(state.soundEnabled ? 'Sound enabled' : 'Sound muted', 'info');
  });

  // Auth Button (Sign In / User Menu Trigger)
  if (DOM.openAuthModalBtn) {
    DOM.openAuthModalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentUser) {
        // Toggle user dropdown menu
        const isShown = DOM.userMenuDropdown.style.display === 'flex';
        DOM.userMenuDropdown.style.display = isShown ? 'none' : 'flex';
      } else {
        setAuthMode('login');
        openModal(DOM.authModal);
      }
    });
  }

  // Close dropdown on outside click
  window.addEventListener('click', (e) => {
    if (DOM.userMenuDropdown && !DOM.authContainer.contains(e.target)) {
      DOM.userMenuDropdown.style.display = 'none';
    }
  });

  // Auth Tabs (Login vs Register)
  if (DOM.tabLoginBtn) {
    DOM.tabLoginBtn.addEventListener('click', () => setAuthMode('login'));
  }
  if (DOM.tabRegisterBtn) {
    DOM.tabRegisterBtn.addEventListener('click', () => setAuthMode('register'));
  }

  // Logout button
  if (DOM.userLogoutBtn) {
    DOM.userLogoutBtn.addEventListener('click', handleUserLogout);
  }

  // Modals Open / Close
  if (DOM.closeAuthModalBtn) {
    DOM.closeAuthModalBtn.addEventListener('click', () => closeModal(DOM.authModal));
  }
  DOM.openThemeModalBtn.addEventListener('click', () => {
    stopThemePulse();
    openModal(DOM.themeModal);
  });
  DOM.closeThemeModalBtn.addEventListener('click', () => closeModal(DOM.themeModal));
  
  DOM.openSettingsModalBtn.addEventListener('click', () => openModal(DOM.settingsModal));
  DOM.closeSettingsModalBtn.addEventListener('click', () => closeModal(DOM.settingsModal));
  DOM.cancelSettingsBtn.addEventListener('click', () => closeModal(DOM.settingsModal));
  DOM.saveSettingsBtn.addEventListener('click', saveSettingsFromModal);

  // Guided Tour Trigger
  if (DOM.startTourBtn) {
    DOM.startTourBtn.addEventListener('click', () => startOnboardingTour(true));
  }

  // Science & Guide Modal Open / Close
  if (DOM.openScienceModalHeaderBtn) {
    DOM.openScienceModalHeaderBtn.addEventListener('click', () => openModal(DOM.scienceModal));
  }
  if (DOM.openScienceModalFooterBtn) {
    DOM.openScienceModalFooterBtn.addEventListener('click', () => openModal(DOM.scienceModal));
  }
  if (DOM.closeScienceModalBtn) {
    DOM.closeScienceModalBtn.addEventListener('click', () => closeModal(DOM.scienceModal));
  }
  if (DOM.closeScienceModalBtnBottom) {
    DOM.closeScienceModalBtnBottom.addEventListener('click', () => closeModal(DOM.scienceModal));
  }

  // Feedback Modal Open / Close
  if (DOM.openFeedbackModalBtn) {
    DOM.openFeedbackModalBtn.addEventListener('click', () => openModal(DOM.feedbackModal));
  }
  if (DOM.closeFeedbackModalBtn) {
    DOM.closeFeedbackModalBtn.addEventListener('click', () => closeModal(DOM.feedbackModal));
  }

  // 4-Pomodoro Guest Sync Modal Actions
  if (DOM.closeGuestSyncModalBtn) {
    DOM.closeGuestSyncModalBtn.addEventListener('click', () => {
      dismissGuestSyncPrompt();
      closeModal(DOM.guestSyncModal);
    });
  }
  if (DOM.guestSyncDismissBtn) {
    DOM.guestSyncDismissBtn.addEventListener('click', () => {
      dismissGuestSyncPrompt();
      closeModal(DOM.guestSyncModal);
      showToast('Continuing in Guest Mode ✨', 'info');
    });
  }
  if (DOM.guestSyncSignupBtn) {
    DOM.guestSyncSignupBtn.addEventListener('click', () => {
      dismissGuestSyncPrompt();
      closeModal(DOM.guestSyncModal);
      setAuthMode('register');
      openModal(DOM.authModal);
    });
  }

  // Backdrop click to close any modal
  [DOM.authModal, DOM.themeModal, DOM.settingsModal, DOM.scienceModal, DOM.feedbackModal, DOM.guestSyncModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  // Theme Preset Buttons
  DOM.themePresetsGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-card-btn');
    if (btn) {
      const preset = btn.getAttribute('data-preset');
      applyTheme(preset, null, true);
      showToast(`Switched theme to ${preset.charAt(0).toUpperCase() + preset.slice(1)}`, 'success');
    }
  });

  // Custom Color Pickers
  [DOM.customBgColor, DOM.customCardColor, DOM.customAccentColor, DOM.customTextColor].forEach(picker => {
    picker.addEventListener('input', updateHexLabels);
  });

  DOM.applyCustomThemeBtn.addEventListener('click', () => {
    const customColors = {
      bg: DOM.customBgColor.value,
      card: DOM.customCardColor.value,
      accent: DOM.customAccentColor.value,
      text: DOM.customTextColor.value
    };
    applyTheme('custom', customColors, true);
    showToast('Custom theme applied!', 'success');
  });

  DOM.resetDefaultThemeBtn.addEventListener('click', () => {
    applyTheme('pomodoro', null, true);
    showToast('Reset to Classic Pomodoro theme', 'info');
  });

  // Sound Test & Notifications
  DOM.settingVolume.addEventListener('input', (e) => {
    DOM.volumePercentLabel.textContent = `${e.target.value}%`;
    state.soundVolume = parseInt(e.target.value, 10) / 100;
  });

  DOM.testSoundBtn.addEventListener('click', () => {
    playChimeSound(DOM.settingSoundType.value);
  });

  DOM.requestNotificationBtn.addEventListener('click', requestNotificationPermission);

  // Stats Actions & Export
  DOM.clearHistoryBtn.addEventListener('click', handleClearHistory);
  if (DOM.exportCsvBtn) {
    DOM.exportCsvBtn.addEventListener('click', exportSessionsToCsv);
  }
  if (DOM.exportCsvSettingsBtn) {
    DOM.exportCsvSettingsBtn.addEventListener('click', exportSessionsToCsv);
  }
  if (DOM.shareStatsBtn) {
    DOM.shareStatsBtn.addEventListener('click', exportShareableFocusCard);
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      toggleStartPause();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      resetTimer();
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      skipSession();
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      toggleZenMode();
    } else if (e.code === 'KeyT') {
      e.preventDefault();
      stopThemePulse();
      DOM.themeModal.classList.contains('open') ? closeModal(DOM.themeModal) : openModal(DOM.themeModal);
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      DOM.soundToggleBtn.click();
    } else if (e.key === 'Escape') {
      if (document.body.classList.contains('zen-mode-active')) {
        toggleZenMode(false);
      }
      [DOM.authModal, DOM.themeModal, DOM.settingsModal, DOM.scienceModal, DOM.feedbackModal, DOM.guestSyncModal].forEach(m => {
        if (m && m.classList.contains('open')) closeModal(m);
      });
    }
  });

  // Fullscreen change listener to sync Zen Mode state
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('zen-mode-active')) {
      // User exited browser fullscreen, maintain clean state or toggle off
    }
  });
}

function submitFeedback() {
  const form = DOM.feedbackForm;
  if (!form) return;

  const message = document.getElementById('feedbackMessage').value;
  if (!message.trim()) return;

  showToast('Thank you for your feedback! 💚', 'success');
  form.reset();
  closeModal(DOM.feedbackModal);
}


// ==========================================================================
// 14. Zen Mode (Full-Screen Distraction-Free Timer)
// ==========================================================================

function toggleZenMode(forcedState = null) {
  const isZen = forcedState !== null ? forcedState : !document.body.classList.contains('zen-mode-active');
  
  if (isZen) {
    document.body.classList.add('zen-mode-active');
    if (DOM.zenExpandIcon) DOM.zenExpandIcon.classList.add('hidden');
    if (DOM.zenCompressIcon) DOM.zenCompressIcon.classList.remove('hidden');
    if (DOM.zenBtnText) DOM.zenBtnText.textContent = 'Exit';
    if (DOM.zenModeBtn) DOM.zenModeBtn.setAttribute('title', 'Exit Zen Mode (Esc or Z)');
    showToast('Zen Mode active — Distraction free! Press Esc or Z to exit.', 'info');
    
    // Request HTML5 fullscreen if supported
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  } else {
    document.body.classList.remove('zen-mode-active');
    if (DOM.zenExpandIcon) DOM.zenExpandIcon.classList.remove('hidden');
    if (DOM.zenCompressIcon) DOM.zenCompressIcon.classList.add('hidden');
    if (DOM.zenBtnText) DOM.zenBtnText.textContent = 'Zen';
    if (DOM.zenModeBtn) DOM.zenModeBtn.setAttribute('title', 'Zen Mode (Distraction-Free) (Z)');
    
    // Exit HTML5 fullscreen if currently active
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (e) {}
  }
}


// ==========================================================================
// 15. Onboarding Tour & Theme Highlight Engine (Driver.js)
// ==========================================================================

function checkFirstTimeUser() {
  const isTourComplete = localStorage.getItem('pomoHavenTourComplete') || localStorage.getItem('pomoClockTourComplete');
  const isThemeClicked = localStorage.getItem('pomoHavenThemeClicked') || localStorage.getItem('pomoClockThemeClicked');

  // Pulse theme button if user hasn't clicked it or completed tour
  if (!isTourComplete && !isThemeClicked && DOM.openThemeModalBtn) {
    DOM.openThemeModalBtn.classList.add('first-time-theme-pulse');
  }

  // Auto-launch guided tour on first visit
  if (!isTourComplete) {
    setTimeout(() => {
      startOnboardingTour(false);
    }, 600);
  }
}

function stopThemePulse() {
  if (DOM.openThemeModalBtn) {
    DOM.openThemeModalBtn.classList.remove('first-time-theme-pulse');
  }
  localStorage.setItem('pomoHavenThemeClicked', 'true');
  localStorage.setItem('pomoClockThemeClicked', 'true');
}

function checkGuestSyncPrompt() {
  // If user is already authenticated, don't prompt
  if (state.currentUser && state.currentUser.authenticated) return;

  const localSessions = getLocalSessions();
  const completedPomodoros = localSessions.filter(s => s.mode === 'pomodoro' && s.status === 'completed').length;
  const lastPromptCount = parseInt(localStorage.getItem('pomohaven_guest_prompt_last_count') || localStorage.getItem('pomoclock_guest_prompt_last_count') || '0', 10);

  // Trigger on 4th session (and multiples of 4: 4, 8, 12...)
  if (completedPomodoros >= 4 && (completedPomodoros % 4 === 0) && completedPomodoros !== lastPromptCount) {
    setTimeout(() => {
      if (DOM.guestSyncModal) {
        openModal(DOM.guestSyncModal);
      }
    }, 1200);
  }
}

function dismissGuestSyncPrompt() {
  const localSessions = getLocalSessions();
  const completedPomodoros = localSessions.filter(s => s.mode === 'pomodoro' && s.status === 'completed').length;
  localStorage.setItem('pomohaven_guest_prompt_last_count', completedPomodoros.toString());
  localStorage.setItem('pomoclock_guest_prompt_last_count', completedPomodoros.toString());
}

function startOnboardingTour(isManual = false) {
  if (typeof window.driver === 'undefined' || !window.driver.js || !window.driver.js.driver) {
    console.warn('Driver.js is not loaded yet');
    return;
  }

  const driver = window.driver.js.driver;
  const driverObj = driver({
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayColor: 'rgba(0, 0, 0, 0.78)',
    stagePadding: 8,
    stageRadius: 14,
    popoverClass: 'driverjs-theme-popover pomohaven-driver-popover',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Got It! 🚀',
    scrollIntoViewOptions: { behavior: 'smooth', block: 'center' },
    onHighlightStarted: (element) => {
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        setTimeout(() => {
          if (driverObj && typeof driverObj.recalculate === 'function') {
            driverObj.recalculate();
          }
        }, 250);
      }
    },
    onDestroyStarted: () => {
      localStorage.setItem('pomoHavenTourComplete', 'true');
      localStorage.setItem('pomoClockTourComplete', 'true');
      stopThemePulse();
      driverObj.destroy();
    },
    steps: [
      {
        element: '.mode-tabs',
        popover: {
          title: '🎯 Focus vs. Break Modes',
          description: 'Set your Pomodoro session (25m), then relax (5m). Cycles keep your energy high without burnout.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#currentTaskInput',
        popover: {
          title: '🎯 Set Your Target',
          description: 'Write down the single task you are locking into right now. Single-tasking is the secret to deep focus.',
          side: 'bottom',
          align: 'center'
        }
      },
      {
        element: '#startPauseBtn',
        popover: {
          title: '⏱️ Start the Sprint',
          description: 'Hit this button (or press <kbd>Space</kbd>) to begin your countdown to deep focus.',
          side: 'top',
          align: 'center'
        }
      },
      {
        element: '#openThemeModalBtn',
        stagePadding: 4,
        popover: {
          title: '🎨 Your Aesthetic',
          description: 'Customize PomoHaven to match your mood here. Choose Classic Pomodoro, Sage, Cyberpunk, or create a custom palette!',
          side: 'bottom',
          align: 'end',
          popoverClass: 'driverjs-theme-popover'
        }
      }
    ]
  });

  driverObj.drive();
}


// ==========================================================================
// 16. Multi-Task Queue & Study Target Engine
// ==========================================================================

const LOCAL_STORAGE_KEY_TASK_QUEUE = 'pomohaven_task_queue';
let taskTargetStepperCount = 2;

function getTaskQueue() {
  try {
    return JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY_TASK_QUEUE) ||
      localStorage.getItem('pomoclock_task_queue') ||
      '[]'
    );
  } catch (e) {
    return [];
  }
}

function saveTaskQueue(tasks) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_TASK_QUEUE, JSON.stringify(tasks));
  } catch (e) {}
  renderTaskQueue();
}

function renderTaskQueue() {
  if (!DOM.taskQueueList || !DOM.taskQueueBadge) return;

  const tasks = getTaskQueue();
  const activeTaskTitle = (DOM.currentTaskInput ? DOM.currentTaskInput.value : '').trim();
  const uncompletedCount = tasks.filter(t => !t.completed).length;

  DOM.taskQueueBadge.textContent = uncompletedCount;

  if (tasks.length === 0) {
    DOM.taskQueueList.innerHTML = '<div class="task-queue-empty">No tasks in queue. Add your first study target above!</div>';
    return;
  }

  DOM.taskQueueList.innerHTML = tasks.map(task => {
    const isActive = activeTaskTitle && task.title.toLowerCase() === activeTaskTitle.toLowerCase();
    return `
      <div class="task-item ${isActive ? 'active-task' : ''} ${task.completed ? 'completed-task' : ''}" data-task-id="${task.id}">
        <label class="task-checkbox-wrap" title="${task.completed ? 'Mark uncompleted' : 'Mark completed'}">
          <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
          <span class="custom-checkbox"></span>
        </label>
        <div class="task-details" data-task-id="${task.id}" title="Click to set as focus target">
          <span class="task-name">${escapeHtml(task.title)}</span>
          <div class="task-pomo-progress">
            <span class="pomo-count">${task.completedPomos || 0}/${task.targetPomos || 1} 🍅</span>
            <div class="task-mini-stepper">
              <button type="button" class="pomo-adjust-btn dec-pomo" data-task-id="${task.id}" title="Decrease target pomodoros">−</button>
              <button type="button" class="pomo-adjust-btn inc-pomo" data-task-id="${task.id}" title="Increase target pomodoros">+</button>
            </div>
          </div>
        </div>
        <div class="task-actions">
          <button type="button" class="task-select-btn" data-task-id="${task.id}" title="Set as active focus task">${isActive ? 'Active' : '🎯 Focus'}</button>
          <button type="button" class="task-delete-btn" data-task-id="${task.id}" title="Delete task">&times;</button>
        </div>
      </div>
    `;
  }).join('');
}

function initTaskQueue() {
  if (!DOM.taskQueueContainer) return;

  // Toggle drawer
  if (DOM.toggleTaskQueueBtn) {
    DOM.toggleTaskQueueBtn.addEventListener('click', () => {
      const isHidden = DOM.taskQueueList.classList.contains('hidden');
      if (isHidden) {
        DOM.taskQueueList.classList.remove('hidden');
        DOM.queueArrow.classList.add('open');
        DOM.toggleTaskQueueBtn.setAttribute('aria-expanded', 'true');
      } else {
        DOM.taskQueueList.classList.add('hidden');
        DOM.queueArrow.classList.remove('open');
        DOM.toggleTaskQueueBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Open add task form
  if (DOM.openAddTaskBtn) {
    DOM.openAddTaskBtn.addEventListener('click', () => {
      DOM.addTaskForm.classList.remove('hidden');
      DOM.taskQueueList.classList.remove('hidden');
      DOM.queueArrow.classList.add('open');
      DOM.toggleTaskQueueBtn.setAttribute('aria-expanded', 'true');
      if (DOM.newTaskTitleInput) {
        DOM.newTaskTitleInput.focus();
      }
    });
  }

  // Cancel add task
  if (DOM.cancelAddTaskBtn) {
    DOM.cancelAddTaskBtn.addEventListener('click', () => {
      DOM.addTaskForm.classList.add('hidden');
      if (DOM.newTaskTitleInput) DOM.newTaskTitleInput.value = '';
    });
  }

  // Stepper controls for new task target
  if (DOM.stepperDecBtn && DOM.stepperIncBtn && DOM.newTargetPomoCount) {
    DOM.stepperDecBtn.addEventListener('click', () => {
      if (taskTargetStepperCount > 1) {
        taskTargetStepperCount--;
        DOM.newTargetPomoCount.textContent = taskTargetStepperCount;
      }
    });
    DOM.stepperIncBtn.addEventListener('click', () => {
      if (taskTargetStepperCount < 20) {
        taskTargetStepperCount++;
        DOM.newTargetPomoCount.textContent = taskTargetStepperCount;
      }
    });
  }

  // Confirm add task
  if (DOM.confirmAddTaskBtn) {
    DOM.confirmAddTaskBtn.addEventListener('click', submitNewTask);
  }

  if (DOM.newTaskTitleInput) {
    DOM.newTaskTitleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitNewTask();
      } else if (e.key === 'Escape') {
        DOM.addTaskForm.classList.add('hidden');
      }
    });
  }

  // Task list event delegation
  if (DOM.taskQueueList) {
    DOM.taskQueueList.addEventListener('click', (e) => {
      const target = e.target;
      const taskId = target.getAttribute('data-task-id') || target.closest('[data-task-id]')?.getAttribute('data-task-id');
      if (!taskId) return;

      const tasks = getTaskQueue();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Checkbox click (mark complete)
      if (target.classList.contains('task-checkbox')) {
        task.completed = target.checked;
        if (task.completed) {
          playChimeSound('bell');
          showToast(`✅ "${task.title}" completed!`, 'success');
        }
        saveTaskQueue(tasks);
        return;
      }

      // Delete button
      if (target.classList.contains('task-delete-btn')) {
        const updated = tasks.filter(t => t.id !== taskId);
        saveTaskQueue(updated);
        showToast('Task removed from queue', 'info');
        return;
      }

      // Target Pomodoro decrement
      if (target.classList.contains('dec-pomo')) {
        if (task.targetPomos > 1) {
          task.targetPomos--;
          saveTaskQueue(tasks);
        }
        return;
      }

      // Target Pomodoro increment
      if (target.classList.contains('inc-pomo')) {
        if (task.targetPomos < 20) {
          task.targetPomos++;
          saveTaskQueue(tasks);
        }
        return;
      }

      // Focus / Select task
      if (target.classList.contains('task-select-btn') || target.classList.contains('task-name') || target.closest('.task-details')) {
        selectQueuedTask(task);
      }
    });
  }

  renderTaskQueue();
}

function submitNewTask() {
  if (!DOM.newTaskTitleInput) return;
  const title = DOM.newTaskTitleInput.value.trim();
  if (!title) {
    showToast('Please enter a task title', 'warning');
    return;
  }

  const tasks = getTaskQueue();
  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title: title,
    targetPomos: taskTargetStepperCount,
    completedPomos: 0,
    completed: false,
    createdAt: new Date().toISOString()
  };

  tasks.push(newTask);
  saveTaskQueue(tasks);

  // If active task input is empty, automatically select
  if (!DOM.currentTaskInput.value.trim()) {
    selectQueuedTask(newTask);
  }

  DOM.newTaskTitleInput.value = '';
  DOM.addTaskForm.classList.add('hidden');
  showToast(`🎯 Added "${title}" (${taskTargetStepperCount} Pomos) to queue`, 'success');
}

function selectQueuedTask(task) {
  if (DOM.currentTaskInput) {
    DOM.currentTaskInput.value = task.title;
    state.currentTask = task.title;
    renderTaskQueue();
    showToast(`🎯 Locked target: "${task.title}"`, 'info');
  }
}

function incrementActiveTaskProgress() {
  const currentTaskName = (state.currentTask || (DOM.currentTaskInput ? DOM.currentTaskInput.value : '')).trim().toLowerCase();
  if (!currentTaskName) return;

  const tasks = getTaskQueue();
  const matchedTask = tasks.find(t => t.title.trim().toLowerCase() === currentTaskName);
  if (matchedTask) {
    matchedTask.completedPomos = (matchedTask.completedPomos || 0) + 1;
    if (matchedTask.completedPomos >= matchedTask.targetPomos && !matchedTask.completed) {
      matchedTask.completed = true;
      showToast(`🏆 Goal reached for "${matchedTask.title}"!`, 'success');
    }
    saveTaskQueue(tasks);
  }
}


// ==========================================================================
// 17. Free One-Click Shareable Focus Card (PNG) & CSV Exporters
// ==========================================================================

async function exportShareableFocusCard() {
  if (typeof html2canvas === 'undefined') {
    showToast('Image renderer is initializing, please try again in a moment.', 'info');
    return;
  }

  showToast('📸 Generating PomoHaven Focus Card...', 'info');

  const cardContainer = document.getElementById('shareCardContainer');
  if (!cardContainer) return;

  // 1. Populate dynamic dates & user info
  const dateElem = document.getElementById('shareCardDate');
  if (dateElem) {
    dateElem.textContent = new Date().toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  const scholarElem = document.getElementById('shareScholarName');
  if (scholarElem) {
    const activeUserName = state.currentUser ? (state.currentUser.name || state.currentUser.username || state.currentUser.email) : 'Guest Scholar';
    scholarElem.textContent = activeUserName;
  }

  // 2. Populate highlight metrics from active stats
  const totalHrsElem = document.getElementById('shareTotalHours');
  if (totalHrsElem && DOM.statTotalHours) {
    totalHrsElem.innerHTML = DOM.statTotalHours.innerHTML;
  }
  const streakElem = document.getElementById('shareStreakDays');
  if (streakElem && DOM.statStreakDays) {
    streakElem.innerHTML = DOM.statStreakDays.innerHTML;
  }
  const todayMinElem = document.getElementById('shareTodayMinutes');
  if (todayMinElem && DOM.statTodayMinutes) {
    todayMinElem.innerHTML = DOM.statTodayMinutes.innerHTML;
  }
  const compCountElem = document.getElementById('shareCompletedCount');
  if (compCountElem && DOM.statCompletedCount) {
    compCountElem.textContent = DOM.statCompletedCount.textContent;
  }

  // 3. Populate weekly focus activity summary badge & chart
  const weekTotalElem = document.getElementById('shareWeekTotal');
  if (weekTotalElem && DOM.chartWeekTotal) {
    weekTotalElem.textContent = DOM.chartWeekTotal.textContent;
  }

  const chartContentElem = document.getElementById('shareChartContent');
  if (chartContentElem && DOM.activityChart) {
    chartContentElem.innerHTML = DOM.activityChart.innerHTML;
  }

  // 4. Temporarily show container for capture (position off-screen)
  cardContainer.style.display = 'block';
  cardContainer.style.position = 'fixed';
  cardContainer.style.top = '0';
  cardContainer.style.left = '-9999px';
  cardContainer.style.zIndex = '-1000';

  try {
    const canvas = await html2canvas(cardContainer, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#150E10',
      logging: false
    });

    const imageURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = imageURL;
    link.download = 'PomoHaven_Focus_Report.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📸 Saved PomoHaven_Focus_Report.png!', 'success');
  } catch (err) {
    console.error('Focus card export error:', err);
    showToast('Failed to generate shareable focus card.', 'error');
  } finally {
    cardContainer.style.display = 'none';
    cardContainer.style.position = '';
    cardContainer.style.top = '';
    cardContainer.style.left = '';
    cardContainer.style.zIndex = '';
  }
}

function exportSessionsToCsv() {
  const sessions = getLocalSessions();
  if (!sessions || sessions.length === 0) {
    showToast('No logged study sessions found to export.', 'info');
    return;
  }

  // Format CSV headers
  const headers = ['Date', 'Timestamp', 'Task/Subject Name', 'Duration (Minutes)', 'Mode', 'Status'];
  const rows = [headers.join(',')];

  sessions.forEach(s => {
    const dateStr = s.start_time ? getSessionLocalDateString(s.start_time) : (s.date || getLocalDateString());
    const timestamp = s.start_time || '';
    const taskName = `"${(s.task_name || 'Focus Session').replace(/"/g, '""')}"`;
    const duration = s.duration_minutes || (s.duration ? Math.round(s.duration / 60) : 0);
    const mode = s.mode || 'pomodoro';
    const status = s.status || 'completed';

    rows.push([dateStr, timestamp, taskName, duration, mode, status].join(','));
  });

  const csvString = rows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const todayStr = getLocalDateString();
  const filename = `PomoHaven_study_report_${todayStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`📊 Exported ${sessions.length} sessions to ${filename}`, 'success');
}


// ==========================================================================
// 18. App Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  if (DOM.progressCircle) {
    DOM.progressCircle.style.strokeDasharray = CIRCUMFERENCE;
  }

  loadStoredSettings();
  setupEventListeners();
  initTaskQueue();
  updateModeTabs();
  updateCycleIndicators();
  updateTimerDisplay();
  updateStatusBadge();

  // Check auth session, init Google Sign-In & load statistics
  checkAuthStatus();
  initGoogleSignIn();
  fetchStatistics();

  // Check for first-time user tour & pulse
  checkFirstTimeUser();
});
