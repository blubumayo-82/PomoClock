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
  autoStartNextCycle: true,
  autoStartBreaks: true,
  autoStartPomodoro: true,

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
// Aliases for mode configuration lookups
MODE_CONFIG.work = MODE_CONFIG.pomodoro;
MODE_CONFIG.focus = MODE_CONFIG.pomodoro;
MODE_CONFIG.shortBreak = MODE_CONFIG.short_break;
MODE_CONFIG.longBreak = MODE_CONFIG.long_break;


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
  exitZenBtn: document.getElementById('exitZenBtn'),
  zenExpandIcon: document.getElementById('zenExpandIcon'),
  zenCompressIcon: document.getElementById('zenCompressIcon'),
  zenBtnText: document.getElementById('zenBtnText'),
  zenTaskBadge: document.getElementById('zenTaskBadge'),
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
  
  // Unified Task Queue & Focus Engine
  unifiedTaskQueue: document.getElementById('unifiedTaskQueue'),
  unifiedTaskForm: document.getElementById('unifiedTaskForm'),
  unifiedTaskInput: document.getElementById('unifiedTaskInput'),
  inputTargetDecBtn: document.getElementById('inputTargetDecBtn'),
  inputTargetIncBtn: document.getElementById('inputTargetIncBtn'),
  inputTargetVal: document.getElementById('inputTargetVal'),
  unifiedTaskAddBtn: document.getElementById('unifiedTaskAddBtn'),
  unifiedQueueList: document.getElementById('unifiedQueueList'),
  // Backwards compatibility mappings:
  currentTaskInput: document.getElementById('unifiedTaskInput') || document.getElementById('currentTaskInput'),
  taskQueueContainer: document.getElementById('unifiedTaskQueue') || document.getElementById('taskQueueContainer'),
  taskQueueList: document.getElementById('unifiedQueueList') || document.getElementById('taskQueueList'),

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
  confirmPasswordFieldGroup: document.getElementById('confirmPasswordFieldGroup'),
  authConfirmPassword: document.getElementById('authConfirmPassword'),
  togglePasswordBtn: document.getElementById('togglePasswordBtn'),
  toggleConfirmPasswordBtn: document.getElementById('toggleConfirmPasswordBtn'),
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
  settingAutoStartNextCycle: document.getElementById('settingAutoStartNextCycle'),
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
  cancelFeedbackModalBtn: document.getElementById('cancelFeedbackModalBtn'),
  submitFeedbackModalBtn: document.getElementById('submitFeedbackModalBtn'),
  feedbackForm: document.getElementById('feedbackForm'),

  // 4-Pomodoro Guest Sync modal elements
  guestSyncModal: document.getElementById('guestSyncModal'),
  closeGuestSyncModalBtn: document.getElementById('closeGuestSyncModalBtn'),
  guestSyncSignupBtn: document.getElementById('guestSyncSignupBtn'),
  guestSyncDismissBtn: document.getElementById('guestSyncDismissBtn'),

  // Privacy & Terms modal elements
  privacyModal: document.getElementById('privacyModal') || document.getElementById('privacy-modal'),
  openPrivacyModalBtn: document.getElementById('openPrivacyModalBtn'),
  closePrivacyModalBtn: document.getElementById('closePrivacyModalBtn'),
  closePrivacyModalBtnBottom: document.getElementById('closePrivacyModalBtnBottom'),

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

function normalizeMode(mode) {
  if (!mode) return 'pomodoro';
  const m = mode.toString().toLowerCase().replace('-', '_');
  if (m === 'work' || m === 'focus' || m === 'pomodoro') return 'pomodoro';
  if (m === 'shortbreak' || m === 'short_break' || m === 'short') return 'short_break';
  if (m === 'longbreak' || m === 'long_break' || m === 'long') return 'long_break';
  return mode;
}

function getUserWorkDuration() {
  // 1. Check global or window userSettings if defined (e.g. userSettings.workTime, workDuration, etc.)
  if (typeof userSettings !== 'undefined' && userSettings) {
    const customTime = userSettings.workTime ?? userSettings.workDuration ?? userSettings.pomodoro ?? userSettings.work;
    if (customTime !== undefined && customTime !== null) {
      const parsed = parseInt(customTime, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed <= 180 ? parsed * 60 : parsed;
      }
    }
  }
  if (typeof window !== 'undefined' && window.userSettings) {
    const customTime = window.userSettings.workTime ?? window.userSettings.workDuration ?? window.userSettings.pomodoro ?? window.userSettings.work;
    if (customTime !== undefined && customTime !== null) {
      const parsed = parseInt(customTime, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed <= 180 ? parsed * 60 : parsed;
      }
    }
  }

  // 2. Check state.durations
  if (state && state.durations) {
    const dur = state.durations.pomodoro || state.durations.work;
    if (dur && dur > 0) return dur;
  }

  // 3. Check localStorage preferences
  try {
    const savedPomo = parseInt(
      localStorage.getItem('pomohaven_dur_pomo') ||
      localStorage.getItem('pomoclock_dur_pomo') ||
      localStorage.getItem('focusflow_dur_pomo'),
      10
    );
    if (!isNaN(savedPomo) && savedPomo > 0) {
      return savedPomo * 60;
    }
  } catch (e) {}

  // 4. Check DOM settings modal input
  const pomoInput = DOM.settingPomodoro || (typeof document !== 'undefined' ? document.getElementById('settingPomodoro') : null);
  if (pomoInput && pomoInput.value) {
    const val = parseInt(pomoInput.value, 10);
    if (!isNaN(val) && val > 0) {
      return val * 60;
    }
  }

  return 25 * 60;
}

function getUserShortBreakDuration() {
  if (typeof userSettings !== 'undefined' && userSettings) {
    const customTime = userSettings.shortBreakTime ?? userSettings.shortBreakDuration ?? userSettings.short_break ?? userSettings.shortBreak;
    if (customTime !== undefined && customTime !== null) {
      const parsed = parseInt(customTime, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed <= 180 ? parsed * 60 : parsed;
    }
  }
  if (typeof window !== 'undefined' && window.userSettings) {
    const customTime = window.userSettings.shortBreakTime ?? window.userSettings.shortBreakDuration ?? window.userSettings.short_break ?? window.userSettings.shortBreak;
    if (customTime !== undefined && customTime !== null) {
      const parsed = parseInt(customTime, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed <= 180 ? parsed * 60 : parsed;
    }
  }
  if (state && state.durations && (state.durations.short_break || state.durations.shortBreak)) {
    const dur = state.durations.short_break || state.durations.shortBreak;
    if (dur && dur > 0) return dur;
  }
  try {
    const saved = parseInt(
      localStorage.getItem('pomohaven_dur_short') ||
      localStorage.getItem('pomoclock_dur_short') ||
      localStorage.getItem('focusflow_dur_short'),
      10
    );
    if (!isNaN(saved) && saved > 0) return saved * 60;
  } catch (e) {}
  const shortInput = DOM.settingShortBreak || (typeof document !== 'undefined' ? document.getElementById('settingShortBreak') : null);
  if (shortInput && shortInput.value) {
    const val = parseInt(shortInput.value, 10);
    if (!isNaN(val) && val > 0) return val * 60;
  }
  return 5 * 60;
}

function getUserLongBreakDuration() {
  if (typeof userSettings !== 'undefined' && userSettings) {
    const customTime = userSettings.longBreakTime ?? userSettings.longBreakDuration ?? userSettings.long_break ?? userSettings.longBreak;
    if (customTime !== undefined && customTime !== null) {
      const parsed = parseInt(customTime, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed <= 180 ? parsed * 60 : parsed;
    }
  }
  if (typeof window !== 'undefined' && window.userSettings) {
    const customTime = window.userSettings.longBreakTime ?? window.userSettings.longBreakDuration ?? window.userSettings.long_break ?? window.userSettings.longBreak;
    if (customTime !== undefined && customTime !== null) {
      const parsed = parseInt(customTime, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed <= 180 ? parsed * 60 : parsed;
    }
  }
  if (state && state.durations && (state.durations.long_break || state.durations.longBreak)) {
    const dur = state.durations.long_break || state.durations.longBreak;
    if (dur && dur > 0) return dur;
  }
  try {
    const saved = parseInt(
      localStorage.getItem('pomohaven_dur_long') ||
      localStorage.getItem('pomoclock_dur_long') ||
      localStorage.getItem('focusflow_dur_long'),
      10
    );
    if (!isNaN(saved) && saved > 0) return saved * 60;
  } catch (e) {}
  const longInput = DOM.settingLongBreak || (typeof document !== 'undefined' ? document.getElementById('settingLongBreak') : null);
  if (longInput && longInput.value) {
    const val = parseInt(longInput.value, 10);
    if (!isNaN(val) && val > 0) return val * 60;
  }
  return 15 * 60;
}

function calculateSessionEta() {
  if (!DOM.etaText) return;

  const totalCycles = state.longBreakInterval || 4;
  const currentCycle = state.cycleCount || 1;
  const currentMode = normalizeMode(state.currentMode || 'pomodoro');
  const remainingCurrentSecs = Math.max(0, state.timeLeft);

  let totalRemainingSecs = remainingCurrentSecs;
  const pomoDuration = state.durations.pomodoro || getUserWorkDuration();
  const shortBreakDuration = state.durations.short_break || getUserShortBreakDuration();

  if (currentMode === 'pomodoro') {
    // Remaining subsequent pomodoros in this 4-cycle block
    const remainingSubsequentPomos = Math.max(0, totalCycles - currentCycle);
    // Remaining short breaks in this 4-cycle block
    const remainingShortBreaks = Math.max(0, totalCycles - currentCycle);
    totalRemainingSecs += (remainingSubsequentPomos * pomoDuration) +
                          (remainingShortBreaks * shortBreakDuration);
  } else if (currentMode === 'short_break') {
    // Current short break is active. Remaining pomodoros to complete the 4-cycle block:
    const remainingPomos = Math.max(0, totalCycles - currentCycle + 1);
    const remainingShortBreaks = Math.max(0, remainingPomos - 1);
    totalRemainingSecs += (remainingPomos * pomoDuration) +
                          (remainingShortBreaks * shortBreakDuration);
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
  if (DOM.timeDisplay) DOM.timeDisplay.textContent = formatted;

  // Dynamic Browser Tab Title formatting:
  // - When running: (MM:SS) PomoHaven (e.g., (24:59) PomoHaven)
  // - When paused/idle: PomoHaven - Cozy & Deep Study Flow
  // - When break active: ☕ Break Time! - PomoHaven (or 🌴 Long Break! - PomoHaven)
  const normCurrent = normalizeMode(state.currentMode);
  if (state.isRunning) {
    document.title = `(${formatted}) PomoHaven`;
  } else if (normCurrent === 'short_break' || normCurrent === 'long_break') {
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
  const normCurrent = normalizeMode(state.currentMode);
  const config = MODE_CONFIG[normCurrent] || MODE_CONFIG.pomodoro;
  if (DOM.statusBadge) {
    DOM.statusBadge.textContent = state.isRunning ? config.statusText : config.readyText;
    if (state.isRunning) {
      DOM.statusBadge.classList.add('running');
    } else {
      DOM.statusBadge.classList.remove('running');
    }
  }
}

function updateCycleIndicators() {
  const totalCycles = state.longBreakInterval || 4;
  if (DOM.cycleLabel) {
    DOM.cycleLabel.textContent = `Cycle ${state.cycleCount} of ${totalCycles}`;
  }
  
  if (DOM.cycleIndicator) {
    const dots = DOM.cycleIndicator.querySelectorAll('.cycle-dot');
    dots.forEach((dot, idx) => {
      dot.classList.remove('active', 'completed');
      if (idx + 1 < state.cycleCount) {
        dot.classList.add('completed');
      } else if (idx + 1 === state.cycleCount) {
        dot.classList.add('active');
      }
    });
  }

  // Persist currentCycle in localStorage whenever cycle updates
  localStorage.setItem('currentCycle', state.cycleCount.toString());

  calculateSessionEta();
}

function updateModeTabs() {
  const modes = ['pomodoro', 'short_break', 'long_break'];
  const normCurrent = normalizeMode(state.currentMode);
  modes.forEach(mode => {
    const tab = DOM['tab' + mode.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')];
    if (tab) {
      tab.classList.toggle('active', normCurrent === mode);
    }
  });
}

function updateModeTabsDisabledState(disabled) {
  const tabs = [DOM.tabPomodoro, DOM.tabShortBreak, DOM.tabLongBreak];
  tabs.forEach(tab => {
    if (!tab) return;
    tab.disabled = false;
    tab.classList.remove('disabled-mode-switch');
  });
}

function saveTimerPersistence(isCurrentlyRunning = null) {
  const running = (isCurrentlyRunning !== null) ? isCurrentlyRunning : state.isRunning;
  const remainingSeconds = state.timeLeft;

  localStorage.setItem('currentCycle', state.cycleCount.toString());
  localStorage.setItem('currentMode', state.currentMode);

  if (running) {
    localStorage.setItem('isPaused', 'false');
    localStorage.removeItem('pausedSecondsLeft');
    const targetEndTime = Date.now() + (remainingSeconds * 1000);
    localStorage.setItem('targetEndTime', targetEndTime.toString());
  } else {
    localStorage.setItem('isPaused', 'true');
    localStorage.setItem('pausedSecondsLeft', remainingSeconds.toString());
    localStorage.removeItem('targetEndTime');
  }

  if (state.sessionStartTime) {
    localStorage.setItem('sessionStartTime', state.sessionStartTime);
  }
}

function clearTimerPersistence() {
  localStorage.removeItem('targetEndTime');
  localStorage.removeItem('pausedSecondsLeft');
  localStorage.setItem('isPaused', 'true');
}

function restoreTimerFromStorage() {
  // 1. Read standardized localStorage state
  const savedCycle = parseInt(localStorage.getItem('currentCycle'), 10) || 1;
  const savedMode = localStorage.getItem('currentMode') || 'pomodoro';
  const isPaused = localStorage.getItem('isPaused') !== 'false';
  const pausedSeconds = parseInt(localStorage.getItem('pausedSecondsLeft'), 10);
  const targetEndTime = parseInt(localStorage.getItem('targetEndTime'), 10);
  const storedStartTime = localStorage.getItem('sessionStartTime');

  // 2. Set internal currentCycle (validated between 1 and 4)
  state.cycleCount = (savedCycle >= 1 && savedCycle <= 4) ? savedCycle : 1;

  // 3. Set internal currentMode
  state.currentMode = normalizeMode(savedMode);
  state.totalDuration = state.durations[state.currentMode] || getUserWorkDuration();

  if (storedStartTime) {
    state.sessionStartTime = storedStartTime;
  }

  // 4. If timer was running before reload and has valid targetEndTime
  if (!isPaused && !isNaN(targetEndTime)) {
    const diff = Math.round((targetEndTime - Date.now()) / 1000);

    if (diff > 0) {
      state.timeLeft = diff;
      updateModeTabs();
      updateCycleIndicators();
      updateTimerDisplay();
      updateStatusBadge();
      startTimer();
      return true;
    } else {
      state.timeLeft = 0;
      updateModeTabs();
      updateCycleIndicators();
      updateTimerDisplay();
      updateStatusBadge();
      clearTimerPersistence();
      handleTimerComplete();
      return true;
    }
  }

  // 5. If isPaused (or default fresh load):
  if (!isNaN(pausedSeconds) && pausedSeconds >= 0) {
    state.timeLeft = pausedSeconds;
  } else {
    state.timeLeft = state.totalDuration;
  }

  state.isRunning = false;

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }

  if (DOM.playIcon) DOM.playIcon.style.display = 'inline-block';
  if (DOM.pauseIcon) DOM.pauseIcon.style.display = 'none';
  if (DOM.startPauseText) DOM.startPauseText.textContent = 'Start';
  if (DOM.startPauseBtn) DOM.startPauseBtn.classList.remove('running');

  // 6. Call UI update functions to sync dots, label, clock display, and tabs
  updateModeTabs();
  updateModeTabsDisabledState(false);
  updateTimerDisplay();
  updateStatusBadge();
  updateCycleIndicators();

  return true;
}

function switchMode(newMode, autoStart = false, bypassProtection = false) {
  const normalizedMode = normalizeMode(newMode);

  // If clicking the same mode and timer is completely idle at initial duration, do nothing
  if (normalizedMode === state.currentMode && !state.isRunning && state.timeLeft === state.totalDuration) {
    return;
  }

  // Check if a session is currently running or paused midway
  const isSessionInProgress = state.isRunning || state.timeLeft < state.totalDuration;

  if (!bypassProtection && isSessionInProgress) {
    const targetTab = DOM['tab' + normalizedMode.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')];
    if (targetTab) {
      targetTab.classList.remove('tab-warning-pulse');
      void targetTab.offsetWidth; // Force DOM reflow to retrigger animation
      targetTab.classList.add('tab-warning-pulse');
      setTimeout(() => targetTab.classList.remove('tab-warning-pulse'), 400);
    }

    const confirmSwitch = window.confirm(
      "A session is currently in progress. Switching modes will reset your current timer. Are you sure you want to switch?"
    );
    if (!confirmSwitch) {
      return; // Cancelled: keep current mode intact
    }
  }

  // Clear running timer interval
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.isRunning = false;
  state.sessionStartTime = null;

  // Reset Start/Pause button UI to idle
  if (DOM.playIcon && DOM.pauseIcon && DOM.startPauseText && DOM.startPauseBtn) {
    DOM.playIcon.style.display = 'inline-block';
    DOM.pauseIcon.style.display = 'none';
    DOM.startPauseText.textContent = 'Start';
    DOM.startPauseBtn.classList.remove('running');
  }

  state.currentMode = normalizedMode;

  if (normalizedMode === 'pomodoro') {
    state.totalDuration = getUserWorkDuration();
    state.durations.pomodoro = state.totalDuration;
    state.durations.work = state.totalDuration;
  } else if (normalizedMode === 'short_break') {
    state.totalDuration = getUserShortBreakDuration();
    state.durations.short_break = state.totalDuration;
  } else if (normalizedMode === 'long_break') {
    state.totalDuration = getUserLongBreakDuration();
    state.durations.long_break = state.totalDuration;
  } else {
    state.totalDuration = state.durations[normalizedMode] || 25 * 60;
  }

  state.timeLeft = state.totalDuration;

  updateModeTabs();
  updateModeTabsDisabledState(false);
  updateTimerDisplay();
  updateStatusBadge();

  // Persist state upon mode transition
  saveTimerPersistence(autoStart);

  if (autoStart) {
    startTimer();
  }
}

function startTimer() {
  if (state.isRunning) return;

  state.isRunning = true;
  state.sessionStartTime = state.sessionStartTime || new Date().toISOString();

  // Switch play/pause icon & text
  if (DOM.playIcon) DOM.playIcon.style.display = 'none';
  if (DOM.pauseIcon) DOM.pauseIcon.style.display = 'inline-block';
  if (DOM.startPauseText) DOM.startPauseText.textContent = 'Pause';
  if (DOM.startPauseBtn) DOM.startPauseBtn.classList.add('running');

  // Disable mode tabs while timer is running
  updateModeTabsDisabledState(true);
  updateStatusBadge();

  // Save running persistence state
  saveTimerPersistence(true);

  const remainingSeconds = state.timeLeft;
  const targetEndTime = Date.now() + (remainingSeconds * 1000);

  if (state.timerInterval) {
    clearInterval(state.timerInterval);
  }

  state.timerInterval = setInterval(() => {
    const remainingMs = targetEndTime - Date.now();
    const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));

    state.timeLeft = remainingSecs;
    updateTimerDisplay();

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      clearTimerPersistence();
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

  // Save paused persistence state
  saveTimerPersistence(false);

  if (DOM.playIcon) DOM.playIcon.style.display = 'inline-block';
  if (DOM.pauseIcon) DOM.pauseIcon.style.display = 'none';
  if (DOM.startPauseText) DOM.startPauseText.textContent = 'Start';
  if (DOM.startPauseBtn) DOM.startPauseBtn.classList.remove('running');

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

  clearTimerPersistence();
  localStorage.removeItem('currentCycle');
  localStorage.removeItem('currentMode');
  localStorage.removeItem('pausedSecondsLeft');
  localStorage.removeItem('targetEndTime');
  localStorage.setItem('isPaused', 'true');

  state.cycleCount = 1;
  state.currentMode = 'pomodoro';
  state.totalDuration = getUserWorkDuration();
  state.durations.pomodoro = state.totalDuration;
  state.durations.work = state.totalDuration;
  state.timeLeft = state.totalDuration;
  state.sessionStartTime = null;

  saveTimerPersistence(false);

  updateModeTabs();
  updateModeTabsDisabledState(false);
  updateTimerDisplay();
  updateStatusBadge();
  updateCycleIndicators();

  if (wasRunning) {
    showToast('Timer reset', 'info');
  }
}

function skipSession() {
  const previousMode = state.currentMode;
  pauseTimer();
  clearTimerPersistence();

  const activeTask = (DOM.currentTaskInput ? DOM.currentTaskInput.value.trim() : state.currentTask) || '';
  state.currentTask = activeTask;

  // Log skipped session if had ran partially
  if (state.sessionStartTime && (state.totalDuration - state.timeLeft) > 10) {
    const durationMins = Math.round(((state.totalDuration - state.timeLeft) / 60) * 10) / 10;
    recordSession({
      mode: previousMode,
      duration_minutes: durationMins,
      start_time: state.sessionStartTime,
      end_time: new Date().toISOString(),
      status: 'skipped',
      task_name: activeTask || 'Study Session'
    });
  }

  transitionToNextMode(false);
  showToast(`Skipped ${MODE_CONFIG[previousMode].title}`, 'info');
}

async function handleTimerComplete() {
  pauseTimer();
  clearTimerPersistence();
  const completedMode = state.currentMode;
  const isWork = (completedMode === 'pomodoro' || completedMode === 'work' || completedMode === 'focus');
  const sessionMode = isWork ? 'work' : completedMode;
  const durationInMinutes = Math.round((state.totalDuration / 60) * 10) / 10;
  const startTime = state.sessionStartTime || new Date(Date.now() - state.totalDuration * 1000).toISOString();
  const endTime = new Date().toISOString();

  const activeTask = (DOM.currentTaskInput ? DOM.currentTaskInput.value.trim() : state.currentTask) || '';
  state.currentTask = activeTask;

  // 1. Play audio chime
  playChimeSound();

  // 2. Desktop notification
  showDesktopNotification(completedMode);

  // 3. Explicit fetch POST request to save the session to PostgreSQL backend
  fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      duration_minutes: durationInMinutes,
      mode: sessionMode,
      start_time: startTime,
      end_time: endTime,
      status: 'completed',
      task_name: activeTask || (isWork ? 'Focus Session' : 'Break Time')
    })
  })
  .then(res => res.json())
  .then(data => {
    console.log('Session synced to Postgres:', data);
    fetchStatistics();
  })
  .catch(err => console.error('Error syncing session:', err));

  // Also save in localStorage for hybrid persistence
  saveLocalSession({
    duration_minutes: durationInMinutes,
    mode: sessionMode,
    start_time: startTime,
    end_time: endTime,
    status: 'completed',
    task_name: activeTask || (isWork ? 'Focus Session' : 'Break Time')
  });

  // 4. Confetti & Celebration for completed pomodoro
  if (isWork) {
    triggerConfettiBurst();
    showToast(`🎉 Great job! Completed ${durationInMinutes}m focus session.`, 'success');
    
    // Automatically increment multi-task queue target progress
    if (typeof incrementActiveTaskProgress === 'function') {
      incrementActiveTaskProgress();
    }

    checkGuestSyncPrompt();
  } else {
    showToast(`⚡ Break finished! Ready for another round?`, 'info');
  }

  // 5. Refresh analytics directly from database
  await fetchStatistics();
  await fetchWeeklyStats();
  await fetchRecentSessions();

  // 6. Transition to the next cycle mode
  transitionToNextMode(true);
}

function transitionToNextMode(isNaturalCompletion = true) {
  const current = normalizeMode(state.currentMode);
  const shouldAutoStart = isNaturalCompletion && (state.autoStartNextCycle ?? true);

  if (current === 'pomodoro') {
    // 1. Focus session completes: stay on SAME cycle number throughout the short break
    localStorage.setItem('currentCycle', state.cycleCount.toString());
    updateCycleIndicators();
    switchMode('short_break', shouldAutoStart, true);
  } else if (current === 'short_break') {
    // 2. Short break finishes: advance currentCycle to next cycle; loop back to Cycle 1 after Cycle 4
    const maxCycles = state.longBreakInterval || 4;
    if (state.cycleCount >= maxCycles) {
      state.cycleCount = 1;
    } else {
      state.cycleCount++;
    }
    localStorage.setItem('currentCycle', state.cycleCount.toString());
    updateCycleIndicators();
    switchMode('pomodoro', shouldAutoStart, true);
  } else if (current === 'long_break') {
    // If long break was manually completed, reset to cycle 1 focus and pause
    state.cycleCount = 1;
    localStorage.setItem('currentCycle', state.cycleCount.toString());
    updateCycleIndicators();
    switchMode('pomodoro', false, true);

    state.isRunning = false;
    state.currentMode = 'pomodoro';
    state.totalDuration = getUserWorkDuration();
    state.durations.pomodoro = state.totalDuration;
    state.durations.work = state.totalDuration;
    state.timeLeft = state.totalDuration;
    state.sessionStartTime = null;

    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }

    if (DOM.playIcon && DOM.pauseIcon && DOM.startPauseText && DOM.startPauseBtn) {
      DOM.playIcon.style.display = 'inline-block';
      DOM.pauseIcon.style.display = 'none';
      DOM.startPauseText.textContent = 'Start';
      DOM.startPauseBtn.classList.remove('running');
    }

    saveTimerPersistence(false);
    updateModeTabs();
    updateModeTabsDisabledState(false);
    updateTimerDisplay();
    updateStatusBadge();
    updateCycleIndicators();
  } else {
    switchMode('pomodoro', shouldAutoStart, true);
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
  // Attach user_id if authenticated
  if (state.currentUser && state.currentUser.id && !payload.user_id) {
    payload.user_id = state.currentUser.id;
  }

  // 1. Store in localStorage immediately for 100% hybrid persistence
  saveLocalSession(payload);

  // 2. Instantly update UI statistics & chart locally and update cache
  const localStats = computeLocalStats();
  localStorage.setItem('pomo_cached_stats', JSON.stringify({ success: true, stats: localStats }));
  renderStatistics(localStats);

  // 3. Send POST request to backend API to persist to PostgreSQL & SQLite
  try {
    const sessionBody = {
      duration_minutes: payload.duration_minutes !== undefined ? payload.duration_minutes : 25,
      mode: payload.mode || 'work',
      start_time: payload.start_time || new Date().toISOString(),
      end_time: payload.end_time || new Date().toISOString(),
      status: payload.status || 'completed',
      task_name: payload.task_name || 'Study Session'
    };
    if (payload.user_id) {
      sessionBody.user_id = payload.user_id;
    }

    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(sessionBody)
    });
    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('Backend unavailable; session preserved safely in local storage.', err);
    return { success: true, local_only: true };
  }
}

// Aliases for compatibility
function saveSession(payload) { return recordSession(payload); }
function recordCompletedSession(payload) { return recordSession(payload); }

function loadCachedStats() {
  try {
    const cachedStatsRaw = localStorage.getItem('pomo_cached_stats');
    if (cachedStatsRaw) {
      const parsed = JSON.parse(cachedStatsRaw);
      const stats = (parsed && parsed.stats) ? parsed.stats : parsed;
      if (stats && (stats.total_focus_minutes !== undefined || stats.total_focus_hours !== undefined)) {
        renderStatistics(stats);
        return true;
      }
    }
  } catch (e) {
    console.warn('Error loading cached stats:', e);
  }

  // Fallback to local session computation
  const localStats = computeLocalStats();
  renderStatistics(localStats);
  return false;
}

async function fetchStatistics() {
  // 1. Instantly render from local storage / cache for 0ms initial load
  loadCachedStats();

  // 2. Fetch authoritative database statistics directly from /api/user-stats or /api/stats
  try {
    const response = await fetch('/api/user-stats', { credentials: 'same-origin' });
    if (response.ok) {
      const result = await response.json();
      const stats = (result && result.stats) ? result.stats : result;
      if (stats) {
        localStorage.setItem('pomo_cached_stats', JSON.stringify(result));
        renderStatistics(stats);
      }
    } else {
      const fallback = await fetch('/api/stats', { credentials: 'same-origin' });
      if (fallback.ok) {
        const fbResult = await fallback.json();
        const fbStats = (fbResult && fbResult.stats) ? fbResult.stats : fbResult;
        if (fbStats) {
          localStorage.setItem('pomo_cached_stats', JSON.stringify(fbResult));
          renderStatistics(fbStats);
        }
      }
    }
  } catch (err) {
    console.warn('Backend stats unavailable, using cached/local fallback:', err);
  }

  // Live weekly chart and recent sessions endpoints
  await fetchWeeklyStats();
  await fetchRecentSessions();
}

async function fetchWeeklyStats() {
  if (!DOM.activityChart) return;
  try {
    const res = await fetch('/api/stats/weekly', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.days && data.minutes) {
      const days = data.days;
      const minutes = data.minutes;
      const totalWeeklyMinutes = minutes.reduce((a, b) => a + (parseFloat(b) || 0), 0);
      const weeklyHours = (totalWeeklyMinutes / 60).toFixed(1);

      if (DOM.chartWeekTotal) {
        DOM.chartWeekTotal.textContent = `${weeklyHours}h this week`;
      }

      const maxMinutes = Math.max(...minutes, 25);
      const todayIndex = days.length - 1;

      let html = '';
      days.forEach((day, index) => {
        const mins = minutes[index] || 0;
        const isToday = index === todayIndex;
        let heightPercent = 0;
        let minHeightPx = '0px';
        let barOpacity = 0.25;

        if (mins > 0) {
          const rawPercent = (mins / maxMinutes) * 100;
          heightPercent = Math.min(100, Math.max(8, Math.round(rawPercent)));
          minHeightPx = '8px';
          barOpacity = 1;
        }

        // Fair Metric Rule: 1 Tomato = Every 25 minutes of cumulative focus time
        const rawMinutes = (minutes[index] !== undefined && minutes[index] !== null) ? minutes[index] : 0;
        const mins = parseFloat(rawMinutes) || 0;
        const tomatoes = Math.floor(mins / 25);
        const badgeVisible = tomatoes >= 1;
        const badgeHtml = badgeVisible ? `🍅 ${tomatoes}` : '';
        const badgeTitle = badgeVisible ? `${tomatoes} Tomato${tomatoes > 1 ? 'es' : ''} (${tomatoes * 25}+ mins focused)` : '';
        const tooltipText = tomatoes > 0 ? `${rawMinutes} mins (🍅 ${tomatoes})` : `${rawMinutes} mins`;

        html += `
          <div class="chart-col ${isToday ? 'today' : ''}">
            <div class="chart-top-badge ${badgeVisible ? 'active' : ''}" style="${badgeVisible ? '' : 'display: none;'}" title="${badgeTitle}">${badgeHtml}</div>
            <div class="chart-tooltip" style="color: #ffffff !important; background: rgba(18, 18, 18, 0.96) !important; z-index: 1000 !important;">${tooltipText}</div>
            <div class="chart-bar-wrap">
              <div class="chart-bar" style="height: ${heightPercent}%; min-height: ${minHeightPx}; opacity: ${barOpacity};"></div>
            </div>
            <span class="chart-day-label">${day}</span>
          </div>
        `;
      });

      DOM.activityChart.innerHTML = html;
    }
  } catch (err) {
    console.warn('Could not fetch weekly stats from /api/stats/weekly:', err);
  }
}

async function fetchRecentSessions() {
  if (!DOM.historyTableBody) return;
  try {
    const res = await fetch('/api/sessions/recent', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const sessions = Array.isArray(data) ? data : (data.sessions || []);

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

      const taskName = s.task_title || s.task_name || 'Study Session';
      const timeVal = s.completed_at || s.start_time;
      let formattedTime = 'Just now';
      try {
        const d = new Date(timeVal);
        formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                        ' (' + (d.getMonth() + 1) + '/' + d.getDate() + ')';
      } catch (e) {
        formattedTime = timeVal || 'Just now';
      }

      html += `
        <tr>
          <td><strong>${modeLabel}</strong></td>
          <td>${escapeHtml(taskName)}</td>
          <td>${s.duration_minutes}m</td>
          <td><span class="status-badge ${s.status || 'completed'}">${s.status || 'completed'}</span></td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${formattedTime}</td>
        </tr>
      `;
    });

    DOM.historyTableBody.innerHTML = html;
  } catch (err) {
    console.warn('Could not fetch recent sessions from /api/sessions/recent:', err);
  }
}

function renderStatistics(stats) {
  if (!stats) return;
  state.currentStats = stats;

  const totalHours = (stats.total_focus_hours !== undefined) 
    ? stats.total_focus_hours 
    : (Math.round(((stats.total_focus_minutes || 0) / 60) * 10) / 10);
  const totalMins = stats.total_focus_minutes || 0;
  const completedCount = (stats.completed_pomodoros !== undefined) 
    ? stats.completed_pomodoros 
    : Math.floor(totalMins / 25);
  const todayMins = (stats.today_focus_minutes !== undefined) ? stats.today_focus_minutes : 0;
  const todaySessions = (stats.today_pomodoros !== undefined) ? stats.today_pomodoros : 0;
  const streakDays = (stats.current_streak_days !== undefined) ? stats.current_streak_days : 0;

  if (DOM.statTotalHours) DOM.statTotalHours.innerHTML = `${totalHours} <small>hrs</small>`;
  if (DOM.statTotalMinutes) DOM.statTotalMinutes.textContent = `${totalMins} mins recorded`;
  if (DOM.statCompletedCount) DOM.statCompletedCount.textContent = completedCount;
  if (DOM.statTotalSessions) DOM.statTotalSessions.textContent = `1 🍅 = 25m focus`;
  if (DOM.statTodayMinutes) DOM.statTodayMinutes.innerHTML = `${todayMins} <small>min</small>`;
  if (DOM.statTodaySessions) DOM.statTodaySessions.textContent = `${todaySessions} sessions today`;
  if (DOM.statStreakDays) DOM.statStreakDays.innerHTML = `${streakDays} <small>days</small>`;

  const weeklyActivity = stats.weekly_activity || [];
  const weekTotalMins = weeklyActivity.reduce((acc, d) => acc + (parseFloat(d.focus_minutes || d.minutes) || 0), 0);
  const weeklyHours = (weekTotalMins / 60).toFixed(1);
  if (DOM.chartWeekTotal) DOM.chartWeekTotal.textContent = `${weeklyHours}h this week`;

  if (weeklyActivity.length > 0) {
    renderWeeklyChart(weeklyActivity);
  }
  if (stats.recent_sessions && stats.recent_sessions.length > 0) {
    renderRecentSessions(stats.recent_sessions);
  }
}

function renderWeeklyChart(activity) {
  if (!DOM.activityChart) return;
  state.currentActivity = activity;

  if (!activity.length) {
    DOM.activityChart.innerHTML = `<div class="chart-loading">No activity recorded this week</div>`;
    return;
  }

  const recordedMins = activity.map(a => parseFloat(a.focus_minutes || a.minutes) || 0);
  const maxMinutes = Math.max(...recordedMins, 25);
  const todayStr = getLocalDateString();

  let html = '';
  activity.forEach(item => {
    const rawMinutes = (item.focus_minutes !== undefined) ? item.focus_minutes : ((item.minutes !== undefined) ? item.minutes : 0);
    const mins = parseFloat(rawMinutes) || 0;
    // Fair Metric Rule: 1 Tomato = Every 25 minutes of cumulative focus time
    const tomatoes = Math.floor(mins / 25);
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

    const badgeVisible = tomatoes >= 1;
    const badgeHtml = badgeVisible ? `🍅 ${tomatoes}` : '';
    const badgeTitle = badgeVisible ? `${tomatoes} Tomato${tomatoes > 1 ? 'es' : ''} (${tomatoes * 25}+ mins focused)` : '';
    const tooltipText = tomatoes > 0 ? `${rawMinutes} mins (🍅 ${tomatoes})` : `${rawMinutes} mins`;

    html += `
      <div class="chart-col ${isToday ? 'today' : ''}">
        <div class="chart-top-badge ${badgeVisible ? 'active' : ''}" style="${badgeVisible ? '' : 'display: none;'}" title="${badgeTitle}">${badgeHtml}</div>
        <div class="chart-tooltip" style="color: #ffffff !important; background: rgba(18, 18, 18, 0.96) !important; z-index: 1000 !important;">${tooltipText}</div>
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height: ${heightPercent}%; min-height: ${minHeightPx}; opacity: ${barOpacity};"></div>
        </div>
        <span class="chart-day-label">${item.day_name || item.day || ''}</span>
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

async function loadUserPreferences() {
  try {
    const res = await fetch('/api/preferences');
    const data = await res.json();
    if (data.success && data.preferences) {
      const prefs = data.preferences;
      if (prefs.theme) {
        setTheme(prefs.theme, false);
      }
      if (prefs.pomodoro_duration) {
        state.durations.pomodoro = parseInt(prefs.pomodoro_duration, 10) * 60;
      }
      if (prefs.short_break_duration) {
        state.durations.short_break = parseInt(prefs.short_break_duration, 10) * 60;
      }
      if (prefs.long_break_duration) {
        state.durations.long_break = parseInt(prefs.long_break_duration, 10) * 60;
      }
      if (prefs.long_break_interval) {
        state.longBreakInterval = parseInt(prefs.long_break_interval, 10);
      }
      if (prefs.sound_type) {
        state.soundType = prefs.sound_type;
      }
      if (prefs.volume) {
        state.volume = parseInt(prefs.volume, 10);
      }
      state.totalDuration = state.durations[state.currentMode];
      if (!state.isRunning) {
        state.timeLeft = state.totalDuration;
        updateTimerDisplay();
      }
    }
  } catch (err) {
    console.warn('Could not load user preferences from server:', err);
  }
}


// ==========================================================================
// 8. User Authentication Module (Google OAuth 2.0 & Email/Password)
// ==========================================================================

let googleSignInRetryCount = 0;
window.googleGsiInitialized = false;

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
        if (!window.googleGsiInitialized) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
          });
          window.googleGsiInitialized = true;
        }

        // Render or re-render button container if empty
        if (!googleBtnContainer.hasChildNodes()) {
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
        }
      } else {
        if (!googleBtnContainer.hasChildNodes() || !document.getElementById('googleDemoBtn')) {
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

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) {
    showToast('Google Sign-In failed or was cancelled.', 'error');
    return;
  }

  DOM.authErrorAlert.style.display = 'none';

  try {
    const payload = parseJwt(response.credential) || {};
    const authData = {
      email: payload.email || '',
      name: payload.name || payload.given_name || (payload.email ? payload.email.split('@')[0] : 'Scholar'),
      google_id: payload.sub || '',
      avatar_url: payload.picture || '',
      credential: response.credential
    };

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authData)
    });

    const data = await res.json();
    console.log('Logged into Postgres backend:', data);

    if (data.error && !data.id && !data.user) {
      DOM.authErrorAlert.textContent = data.error || 'Google authentication failed';
      DOM.authErrorAlert.style.display = 'block';
      return;
    }

    const loggedUser = data.user || {
      id: data.id,
      email: data.email,
      name: data.name,
      username: data.name,
      avatar_url: payload.picture || ''
    };

    state.currentUser = loggedUser;
    updateAuthUI();
    closeModal(DOM.authModal);
    showToast(`Welcome, ${loggedUser.name || loggedUser.email}! Google Cloud Sync active ✨`, 'success');

    // Auto-sync guest sessions, user preferences, and stats with database
    await syncLocalSessionsWithServer();
    await loadUserPreferences();
    await fetchStatistics();
  } catch (err) {
    console.error('Google sign-in error:', err);
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
        <span class="user-avatar-circle auth-avatar-pill">
          <img src="${escapeHtml(avatarUrl)}" class="avatar-img-round" alt="Avatar" referrerpolicy="no-referrer">
        </span>
        <span class="header-btn-text user-name-text">${escapeHtml(displayName)}</span>
      `;
    } else {
      DOM.openAuthModalBtn.innerHTML = `
        <span class="user-avatar-circle auth-avatar-pill">
          <span class="avatar-initials-badge">${initial}</span>
        </span>
        <span class="header-btn-text user-name-text">${escapeHtml(displayName)}</span>
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
      <span class="user-avatar-circle auth-default-avatar">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </span>
      <span class="header-btn-text">Sign In</span>
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
    if (DOM.confirmPasswordFieldGroup) DOM.confirmPasswordFieldGroup.style.display = 'block';
    if (DOM.authConfirmPassword) DOM.authConfirmPassword.required = true;
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
    if (DOM.confirmPasswordFieldGroup) DOM.confirmPasswordFieldGroup.style.display = 'none';
    if (DOM.authConfirmPassword) {
      DOM.authConfirmPassword.required = false;
      DOM.authConfirmPassword.value = '';
    }
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

  // Validate matching passwords on frontend for registration
  if (state.authMode === 'register') {
    const confirmPassword = DOM.authConfirmPassword ? DOM.authConfirmPassword.value : '';
    if (password !== confirmPassword) {
      DOM.authErrorAlert.textContent = 'Passwords do not match.';
      DOM.authErrorAlert.style.display = 'block';
      if (DOM.authConfirmPassword) DOM.authConfirmPassword.focus();
      return;
    }
  }

  DOM.authSubmitBtn.disabled = true;
  DOM.authSubmitBtn.textContent = 'Please wait...';

  try {
    let endpoint = '/api/auth/login';
    let payload = { email: emailOrLogin, login: emailOrLogin, password };

    if (state.authMode === 'register') {
      const confirmPassword = DOM.authConfirmPassword ? DOM.authConfirmPassword.value : '';
      endpoint = '/api/auth/register';
      payload = { name, username: name, email: emailOrLogin, password, confirm_password: confirmPassword };
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
  pomodoro: { bg: '#D3A08D', card: '#EDE6E3', accent: '#FF4B3A', text: '#2C1810', rgb: '255, 75, 58' },
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

function normalizeHex(val) {
  if (!val || typeof val !== 'string') return null;
  let clean = val.trim();
  if (!clean.startsWith('#')) clean = '#' + clean;
  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
    return clean.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    const r = clean[1], g = clean[2], b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

function previewLiveCustomColors() {
  const customColors = {
    bg: DOM.customBgColor ? DOM.customBgColor.value : '#D3A08D',
    card: DOM.customCardColor ? DOM.customCardColor.value : '#EDE6E3',
    accent: DOM.customAccentColor ? DOM.customAccentColor.value : '#FF4B3A',
    text: DOM.customTextColor ? DOM.customTextColor.value : '#2C1810'
  };
  applyTheme('custom', customColors, false);
}

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
  const pairs = [
    { input: DOM.customBgHex, picker: DOM.customBgColor, fallback: '#D3A08D' },
    { input: DOM.customCardHex, picker: DOM.customCardColor, fallback: '#EDE6E3' },
    { input: DOM.customAccentHex, picker: DOM.customAccentColor, fallback: '#FF4B3A' },
    { input: DOM.customTextHex, picker: DOM.customTextColor, fallback: '#2C1810' }
  ];
  pairs.forEach(({ input, picker, fallback }) => {
    if (input) {
      const val = (picker ? picker.value : fallback).toUpperCase();
      if ('value' in input) input.value = val;
      input.textContent = val;
    }
  });
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
  try {
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
    
    const savedAutoNextRaw = localStorage.getItem('pomohaven_auto_start_next') ?? localStorage.getItem('pomohaven_auto_next_cycle');
    const savedAutoBreaksRaw = localStorage.getItem('pomohaven_auto_breaks');
    const savedAutoPomoRaw = localStorage.getItem('pomohaven_auto_pomo');
    
    let autoNextEnabled = true; // Default state: Enabled (true)
    if (savedAutoNextRaw !== null) {
      autoNextEnabled = savedAutoNextRaw === 'true';
    } else if (savedAutoBreaksRaw !== null || savedAutoPomoRaw !== null) {
      autoNextEnabled = (savedAutoBreaksRaw === 'true' || savedAutoPomoRaw === 'true');
    }

    const savedSound = localStorage.getItem('pomohaven_sound_type') || localStorage.getItem('pomoclock_sound_type') || localStorage.getItem('focusflow_sound_type') || 'zen';
    const savedVolume = parseFloat(localStorage.getItem('pomohaven_sound_volume') || localStorage.getItem('pomoclock_sound_volume') || localStorage.getItem('focusflow_sound_volume'));

    if (!isNaN(savedPomo) && savedPomo > 0) state.durations.pomodoro = savedPomo * 60;
    if (!isNaN(savedShort) && savedShort > 0) state.durations.short_break = savedShort * 60;
    if (!isNaN(savedLong) && savedLong > 0) state.durations.long_break = savedLong * 60;
    if (!isNaN(savedInterval) && savedInterval >= 2) state.longBreakInterval = savedInterval;
    state.autoStartNextCycle = autoNextEnabled;
    state.autoStartBreaks = autoNextEnabled;
    state.autoStartPomodoro = autoNextEnabled;
    state.soundType = savedSound;
    if (!isNaN(savedVolume)) state.soundVolume = savedVolume;

    // Defensive DOM assignments with null guards & optional chaining
    const pomoEl = DOM.settingPomodoro || document.getElementById('settingPomodoro');
    if (pomoEl) pomoEl.value = Math.round(state.durations.pomodoro / 60);

    const shortEl = DOM.settingShortBreak || document.getElementById('settingShortBreak');
    if (shortEl) shortEl.value = Math.round(state.durations.short_break / 60);

    const longEl = DOM.settingLongBreak || document.getElementById('settingLongBreak');
    if (longEl) longEl.value = Math.round(state.durations.long_break / 60);

    const intervalEl = DOM.settingLongBreakInterval || document.getElementById('settingLongBreakInterval');
    if (intervalEl) intervalEl.value = state.longBreakInterval;
    
    const autoNextEl = DOM.settingAutoStartNextCycle || document.getElementById('settingAutoStartNextCycle') || document.getElementById('auto-transition-toggle');
    if (autoNextEl) autoNextEl.checked = autoNextEnabled;

    const autoBreaksEl = DOM.settingAutoStartBreaks || document.getElementById('settingAutoStartBreaks');
    if (autoBreaksEl) autoBreaksEl.checked = autoNextEnabled;

    const autoPomoEl = DOM.settingAutoStartPomodoro || document.getElementById('settingAutoStartPomodoro');
    if (autoPomoEl) autoPomoEl.checked = autoNextEnabled;

    const soundEl = DOM.settingSoundType || document.getElementById('settingSoundType');
    if (soundEl) soundEl.value = state.soundType;

    const volEl = DOM.settingVolume || document.getElementById('settingVolume');
    if (volEl) volEl.value = Math.round(state.soundVolume * 100);

    const volLabelEl = DOM.volumePercentLabel || document.getElementById('volumePercentLabel');
    if (volLabelEl) volLabelEl.textContent = `${Math.round(state.soundVolume * 100)}%`;

    // Dynamically update mode badges from loaded settings
    updateModeBadges();
  } catch (e) {
    console.warn("Settings load warning:", e);
  }
}

function saveSettingsFromModal() {
  const pomoMins = DOM.settingPomodoro ? parseInt(DOM.settingPomodoro.value, 10) : 25;
  const shortMins = DOM.settingShortBreak ? parseInt(DOM.settingShortBreak.value, 10) : 5;
  const longMins = DOM.settingLongBreak ? parseInt(DOM.settingLongBreak.value, 10) : 15;
  const interval = DOM.settingLongBreakInterval ? parseInt(DOM.settingLongBreakInterval.value, 10) : 4;

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

  const autoNextToggle = DOM.settingAutoStartNextCycle || document.getElementById('settingAutoStartNextCycle') || document.getElementById('auto-transition-toggle');
  if (autoNextToggle) {
    state.autoStartNextCycle = Boolean(autoNextToggle.checked);
  } else if (DOM.settingAutoStartBreaks) {
    state.autoStartNextCycle = Boolean(DOM.settingAutoStartBreaks.checked);
  }
  state.autoStartBreaks = state.autoStartNextCycle;
  state.autoStartPomodoro = state.autoStartNextCycle;
  
  if (DOM.settingSoundType) state.soundType = DOM.settingSoundType.value;
  if (DOM.settingVolume) state.soundVolume = parseInt(DOM.settingVolume.value, 10) / 100;

  localStorage.setItem('pomohaven_auto_start_next', state.autoStartNextCycle);
  localStorage.setItem('pomohaven_auto_breaks', state.autoStartNextCycle);
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
  if (DOM.settingsModal) closeModal(DOM.settingsModal);
  showToast('Settings saved successfully', 'success');

  syncPreferences({
    pomodoro_duration: pomoMins,
    short_break_duration: shortMins,
    long_break_duration: longMins,
    sound_type: state.soundType
  });
}

let lastFocusedElementBeforeModal = null;

function openModal(modal, triggerElement = null) {
  if (!modal) return;
  lastFocusedElementBeforeModal = triggerElement || document.activeElement;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (modal === DOM.authModal) {
    initGoogleSignIn();
  }
}

function closeModal(modal) {
  if (!modal) return;

  // If focus is currently inside the modal being hidden, blur it or return to trigger
  if (document.activeElement && modal.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (lastFocusedElementBeforeModal && typeof lastFocusedElementBeforeModal.focus === 'function') {
    try {
      lastFocusedElementBeforeModal.focus();
    } catch (_) {}
    lastFocusedElementBeforeModal = null;
  }
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
  if (DOM.startPauseBtn) DOM.startPauseBtn.addEventListener('click', toggleStartPause);
  if (DOM.resetBtn) DOM.resetBtn.addEventListener('click', resetTimer);
  if (DOM.skipBtn) DOM.skipBtn.addEventListener('click', skipSession);
  if (DOM.zenModeBtn) {
    DOM.zenModeBtn.addEventListener('click', () => toggleZenMode(true));
  }
  if (DOM.exitZenBtn) {
    DOM.exitZenBtn.addEventListener('click', () => toggleZenMode(false));
  }

  // Mode Selection Tabs
  if (DOM.tabPomodoro) DOM.tabPomodoro.addEventListener('click', () => switchMode('pomodoro'));
  if (DOM.tabShortBreak) DOM.tabShortBreak.addEventListener('click', () => switchMode('short_break'));
  if (DOM.tabLongBreak) DOM.tabLongBreak.addEventListener('click', () => switchMode('long_break'));

  // Unified Task Queue Input (Auto-Active on typing if no active task)
  const taskInputElem = DOM.unifiedTaskInput || DOM.currentTaskInput;
  if (taskInputElem) {
    taskInputElem.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      const tasks = getTaskQueue();
      if (!tasks.some(t => !t.completed)) {
        state.currentTask = val;
        updateZenTaskDisplay();
      }
    });
  }

  // Sound Toggle (Mute / Unmute)
  if (DOM.soundToggleBtn) {
    DOM.soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      DOM.soundToggleBtn.style.opacity = state.soundEnabled ? '1' : '0.4';
      if (DOM.soundWave) DOM.soundWave.style.display = state.soundEnabled ? 'block' : 'none';
      showToast(state.soundEnabled ? 'Sound enabled' : 'Sound muted', 'info');
    });
  }

  // Auth Button (Sign In / User Menu Trigger)
  if (DOM.openAuthModalBtn) {
    DOM.openAuthModalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.currentUser) {
        // Toggle user dropdown menu
        if (DOM.userMenuDropdown) {
          const isShown = DOM.userMenuDropdown.style.display === 'flex';
          DOM.userMenuDropdown.style.display = isShown ? 'none' : 'flex';
        }
      } else {
        setAuthMode('login');
        openModal(DOM.authModal);
      }
    });
  }

  // Close dropdown on outside click
  window.addEventListener('click', (e) => {
    if (DOM.userMenuDropdown && DOM.authContainer && !DOM.authContainer.contains(e.target)) {
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

  // Password Visibility Toggles
  function setupPasswordToggle(toggleBtn, inputElem) {
    if (!toggleBtn || !inputElem) return;
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isPass = inputElem.type === 'password';
      inputElem.type = isPass ? 'text' : 'password';

      const openEye = toggleBtn.querySelector('.eye-open');
      const closedEye = toggleBtn.querySelector('.eye-closed');
      if (openEye && closedEye) {
        openEye.style.display = isPass ? 'none' : 'inline-block';
        closedEye.style.display = isPass ? 'inline-block' : 'none';
      }
      inputElem.focus();
    });
  }

  setupPasswordToggle(DOM.togglePasswordBtn, DOM.authPassword);
  setupPasswordToggle(DOM.toggleConfirmPasswordBtn, DOM.authConfirmPassword);

  // Logout button
  if (DOM.userLogoutBtn) {
    DOM.userLogoutBtn.addEventListener('click', handleUserLogout);
  }

  // Modals Open / Close
  if (DOM.closeAuthModalBtn) {
    DOM.closeAuthModalBtn.addEventListener('click', () => closeModal(DOM.authModal));
  }
  if (DOM.openThemeModalBtn) {
    DOM.openThemeModalBtn.addEventListener('click', () => {
      stopThemePulse();
      openModal(DOM.themeModal);
    });
  }
  if (DOM.closeThemeModalBtn) {
    DOM.closeThemeModalBtn.addEventListener('click', () => closeModal(DOM.themeModal));
  }
  
  if (DOM.openSettingsModalBtn) {
    DOM.openSettingsModalBtn.addEventListener('click', () => openModal(DOM.settingsModal));
  }
  if (DOM.closeSettingsModalBtn) {
    DOM.closeSettingsModalBtn.addEventListener('click', () => closeModal(DOM.settingsModal));
  }
  if (DOM.cancelSettingsBtn) {
    DOM.cancelSettingsBtn.addEventListener('click', () => closeModal(DOM.settingsModal));
  }
  if (DOM.saveSettingsBtn) {
    DOM.saveSettingsBtn.addEventListener('click', saveSettingsFromModal);
  }
  
  const autoNextToggleElem = DOM.settingAutoStartNextCycle || document.getElementById('settingAutoStartNextCycle') || document.getElementById('auto-transition-toggle');
  if (autoNextToggleElem) {
    autoNextToggleElem.addEventListener('change', (e) => {
      state.autoStartNextCycle = e.target.checked;
      state.autoStartBreaks = state.autoStartNextCycle;
      state.autoStartPomodoro = state.autoStartNextCycle;
      localStorage.setItem('pomohaven_auto_start_next', state.autoStartNextCycle);
      localStorage.setItem('pomohaven_auto_breaks', state.autoStartNextCycle);
      localStorage.setItem('pomohaven_auto_pomo', state.autoStartNextCycle);
    });
  }

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

  // Feedback Modal Open / Close / Cancel / Form Submit
  if (DOM.openFeedbackModalBtn) {
    DOM.openFeedbackModalBtn.addEventListener('click', () => openModal(DOM.feedbackModal));
  }
  if (DOM.closeFeedbackModalBtn) {
    DOM.closeFeedbackModalBtn.addEventListener('click', () => {
      if (DOM.feedbackForm) DOM.feedbackForm.reset();
      const messageInput = document.getElementById('feedbackMessage') || document.getElementById('feedback-message') || document.querySelector('textarea[name="message"]');
      if (messageInput) messageInput.value = '';
      closeModal(DOM.feedbackModal);
    });
  }
  if (DOM.cancelFeedbackModalBtn) {
    DOM.cancelFeedbackModalBtn.addEventListener('click', () => {
      if (DOM.feedbackForm) DOM.feedbackForm.reset();
      const messageInput = document.getElementById('feedbackMessage') || document.getElementById('feedback-message') || document.querySelector('textarea[name="message"]');
      if (messageInput) messageInput.value = '';
      closeModal(DOM.feedbackModal);
    });
  }
  if (DOM.feedbackForm) {
    DOM.feedbackForm.addEventListener('submit', handleFeedbackSubmit);
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

  // Privacy & Terms Modal Open / Close
  if (DOM.openPrivacyModalBtn) {
    DOM.openPrivacyModalBtn.addEventListener('click', () => openModal(DOM.privacyModal));
  }
  if (DOM.closePrivacyModalBtn) {
    DOM.closePrivacyModalBtn.addEventListener('click', () => closeModal(DOM.privacyModal));
  }
  if (DOM.closePrivacyModalBtnBottom) {
    DOM.closePrivacyModalBtnBottom.addEventListener('click', () => closeModal(DOM.privacyModal));
  }

  // Backdrop click to close any modal
  [DOM.authModal, DOM.themeModal, DOM.settingsModal, DOM.scienceModal, DOM.feedbackModal, DOM.guestSyncModal, DOM.privacyModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    }
  });

  // Theme Preset Buttons
  if (DOM.themePresetsGrid) {
    DOM.themePresetsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.theme-card-btn');
      if (btn) {
        const preset = btn.getAttribute('data-preset');
        applyTheme(preset, null, true);
        showToast(`Switched theme to ${preset.charAt(0).toUpperCase() + preset.slice(1)}`, 'success');
      }
    });
  }

  // Custom Color Pickers with Two-Way Hex Sync & Live Preview
  const colorSyncPairs = [
    { picker: DOM.customBgColor, hexInput: DOM.customBgHex },
    { picker: DOM.customCardColor, hexInput: DOM.customCardHex },
    { picker: DOM.customAccentColor, hexInput: DOM.customAccentHex },
    { picker: DOM.customTextColor, hexInput: DOM.customTextHex }
  ];

  colorSyncPairs.forEach(({ picker, hexInput }) => {
    if (picker && hexInput) {
      // 1. Swatch -> Hex Input + Live Sync
      picker.addEventListener('input', () => {
        hexInput.value = picker.value.toUpperCase();
        previewLiveCustomColors();
      });

      // 2. Hex Input -> Swatch + Live Sync
      hexInput.addEventListener('input', () => {
        const norm = normalizeHex(hexInput.value);
        if (norm) {
          picker.value = norm;
          previewLiveCustomColors();
        }
      });

      // 3. Format/Validate on blur
      hexInput.addEventListener('blur', () => {
        const norm = normalizeHex(hexInput.value);
        if (norm) {
          hexInput.value = norm;
          picker.value = norm;
        } else {
          hexInput.value = picker.value.toUpperCase();
        }
      });
    }
  });

  if (DOM.applyCustomThemeBtn) {
    DOM.applyCustomThemeBtn.addEventListener('click', () => {
      const customColors = {
        bg: DOM.customBgColor ? DOM.customBgColor.value : '#D3A08D',
        card: DOM.customCardColor ? DOM.customCardColor.value : '#EDE6E3',
        accent: DOM.customAccentColor ? DOM.customAccentColor.value : '#FF4B3A',
        text: DOM.customTextColor ? DOM.customTextColor.value : '#2C1810'
      };
      applyTheme('custom', customColors, true);
      showToast('Custom theme applied!', 'success');
    });
  }

  if (DOM.resetDefaultThemeBtn) {
    DOM.resetDefaultThemeBtn.addEventListener('click', () => {
      applyTheme('pomodoro', null, true);
      showToast('Reset to Classic Pomodoro theme', 'info');
    });
  }

  // Sound Test & Notifications
  if (DOM.settingVolume) {
    DOM.settingVolume.addEventListener('input', (e) => {
      if (DOM.volumePercentLabel) DOM.volumePercentLabel.textContent = `${e.target.value}%`;
      state.soundVolume = parseInt(e.target.value, 10) / 100;
    });
  }

  if (DOM.testSoundBtn) {
    DOM.testSoundBtn.addEventListener('click', () => {
      const soundType = DOM.settingSoundType ? DOM.settingSoundType.value : state.soundType;
      playChimeSound(soundType);
    });
  }

  if (DOM.requestNotificationBtn) {
    DOM.requestNotificationBtn.addEventListener('click', requestNotificationPermission);
  }

  // Stats Actions & Export
  if (DOM.clearHistoryBtn) DOM.clearHistoryBtn.addEventListener('click', handleClearHistory);
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
        if (document.body.classList.contains('zen-mode-active') || document.body.classList.contains('zen-mode')) {
          toggleZenMode(false);
        }
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
      if (document.body.classList.contains('zen-mode-active') || document.body.classList.contains('zen-mode')) {
        toggleZenMode(false);
      }
      [DOM.authModal, DOM.themeModal, DOM.settingsModal, DOM.scienceModal, DOM.feedbackModal, DOM.guestSyncModal, DOM.privacyModal].forEach(m => {
        if (m && m.classList.contains('open')) closeModal(m);
      });
    }
  });

  // Fullscreen change listener to sync Zen Mode state
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && (document.body.classList.contains('zen-mode-active') || document.body.classList.contains('zen-mode'))) {
      toggleZenMode(false);
    }
  });
}

let isSubmittingFeedback = false;

async function handleFeedbackSubmit(e) {
  if (e) e.preventDefault();
  if (isSubmittingFeedback) return;

  const messageInput = document.getElementById('feedbackMessage') || document.getElementById('feedback-message') || document.querySelector('textarea[name="message"]');
  const typeSelect = document.getElementById('feedbackType') || document.getElementById('feedback-type') || document.querySelector('select[name="feedback_type"]');
  const form = DOM.feedbackForm || document.getElementById('feedbackForm');
  const submitBtn = DOM.submitFeedbackModalBtn || document.getElementById('submitFeedbackModalBtn') || document.getElementById('feedback-submit-btn');

  const message = messageInput ? messageInput.value.trim() : '';
  const feedback_type = typeSelect ? typeSelect.value : 'Feature Request';

  if (!message) {
    showToast('Please enter your feedback message.', 'info');
    return;
  }

  isSubmittingFeedback = true;
  const originalBtnText = submitBtn ? submitBtn.textContent : 'Submit Feedback';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  const payload = {
    message: message,
    feedback_type: feedback_type,
    email: state.currentUser ? state.currentUser.email : ''
  };

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.success !== false)) {
      if (messageInput) messageInput.value = '';
      if (form) form.reset();
      showToast('Thank you! Your feedback has been recorded. 🍅', 'success');
      if (DOM.feedbackModal) {
        closeModal(DOM.feedbackModal);
      }
    } else {
      showToast(data.error || 'Failed to submit feedback. Please try again.', 'error');
    }
  } catch (err) {
    console.error('Feedback submission error:', err);
    if (messageInput) messageInput.value = '';
    if (form) form.reset();
    showToast('Thank you! Your feedback has been recorded. 🍅', 'success');
    if (DOM.feedbackModal) {
      closeModal(DOM.feedbackModal);
    }
  } finally {
    isSubmittingFeedback = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }
}

const submitFeedback = handleFeedbackSubmit;
window.handleFeedbackSubmit = handleFeedbackSubmit;
window.submitFeedback = submitFeedback;


// ==========================================================================
// 14. Zen Mode (Full-Screen Distraction-Free Timer)
// ==========================================================================

function updateZenTaskDisplay() {
  if (!DOM.zenTaskBadge) return;
  const tasks = getTaskQueue();
  const currentTaskName = (state.currentTask || (DOM.unifiedTaskInput ? DOM.unifiedTaskInput.value : '') || '').trim();
  
  let activeTask = null;
  if (currentTaskName) {
    activeTask = tasks.find(t => (t.title || t.text || '').toLowerCase() === currentTaskName.toLowerCase());
  }
  if (!activeTask) {
    activeTask = tasks.find(t => !t.completed);
  }

  if (activeTask) {
    state.currentTask = activeTask.title || activeTask.text || '';
    const completed = activeTask.completedPomos || 0;
    const target = activeTask.targetPomos || 1;
    DOM.zenTaskBadge.innerHTML = `🎯 <span class="zen-task-title">${escapeHtml(state.currentTask)}</span> <span class="zen-task-divider">•</span> <span class="zen-task-pomo">🍅 ${completed}/${target}</span>`;
    DOM.zenTaskBadge.classList.remove('hidden');
  } else if (currentTaskName) {
    DOM.zenTaskBadge.innerHTML = `🎯 <span class="zen-task-title">${escapeHtml(currentTaskName)}</span>`;
    DOM.zenTaskBadge.classList.remove('hidden');
  } else {
    DOM.zenTaskBadge.innerHTML = '';
    DOM.zenTaskBadge.classList.add('hidden');
  }
}

function toggleZenMode(forcedState = null) {
  const isZen = forcedState !== null ? forcedState : !document.body.classList.contains('zen-mode-active');
  
  if (isZen) {
    updateZenTaskDisplay();
    document.body.classList.add('zen-mode-active');
    showToast('Full Mode active — Distraction free! Press Esc or Z to exit.', 'info');
    
    // Request HTML5 fullscreen if supported
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (e) {}
  } else {
    document.body.classList.remove('zen-mode-active');
    
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
        element: '#unifiedTaskInput',
        popover: {
          title: '🎯 Set Your Target',
          description: 'Type what you are working on, set your planned Pomodoro goal, and click Add to queue it up.',
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
// 16. Unified Multi-Task Queue & Study Target Engine
// ==========================================================================

const LOCAL_STORAGE_KEY_TASK_QUEUE = 'pomohaven_task_queue';
let initialTargetStepperCount = 1;

function getTaskQueue() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEY_TASK_QUEUE) ||
      localStorage.getItem('pomoclock_task_queue') ||
      '[]'
    );
    return raw.map(t => ({
      id: t.id || 'task_' + Math.random().toString(36).substr(2, 9),
      title: t.title || t.text || 'Focus Task',
      text: t.title || t.text || 'Focus Task',
      targetPomos: Math.max(1, parseInt(t.targetPomos, 10) || 1),
      completedPomos: Math.max(0, parseInt(t.completedPomos, 10) || 0),
      completed: Boolean(t.completed),
      createdAt: t.createdAt || new Date().toISOString()
    }));
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
  const container = DOM.unifiedQueueList || DOM.taskQueueList || document.getElementById('unifiedQueueList');
  if (!container) return;

  const tasks = getTaskQueue();
  const currentTaskName = (state.currentTask || (DOM.unifiedTaskInput ? DOM.unifiedTaskInput.value : '') || '').trim().toLowerCase();

  // If no task is marked active, and we have uncompleted tasks, set the first uncompleted task as active
  let activeTask = null;
  if (currentTaskName) {
    activeTask = tasks.find(t => (t.title || t.text || '').toLowerCase() === currentTaskName && !t.completed);
  }
  if (!activeTask) {
    activeTask = tasks.find(t => !t.completed);
    if (activeTask) {
      state.currentTask = activeTask.title || activeTask.text || '';
    }
  }

  updateZenTaskDisplay();

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="unified-queue-empty">
        <span class="empty-icon">📋</span>
        <span>No tasks in queue. Add your first goal above to start focusing!</span>
      </div>
    `;
    return;
  }

  container.innerHTML = tasks.map(task => {
    const taskTitle = task.title || task.text || '';
    const isActive = activeTask && activeTask.id === task.id && !task.completed;
    const isCompleted = task.completed || (task.completedPomos >= task.targetPomos);
    const minTarget = Math.max(1, task.completedPomos || 0);
    const canDecrement = (task.targetPomos || 1) > minTarget;

    return `
      <div class="unified-task-card ${isActive ? 'active-focus' : ''} ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
        <label class="task-check-wrap" title="${isCompleted ? 'Mark uncompleted' : 'Mark completed'}">
          <input type="checkbox" class="unified-task-checkbox" data-task-id="${task.id}" ${isCompleted ? 'checked' : ''}>
          <span class="custom-check"></span>
        </label>
        <div class="unified-task-info" data-task-id="${task.id}" title="Click to focus on this task">
          <span class="unified-task-title">${escapeHtml(taskTitle)}</span>
          <div class="unified-pomo-stepper" title="Progress: ${task.completedPomos || 0}/${task.targetPomos || 1} Pomodoros">
            <button type="button" class="pomo-step-btn dec-pomo-btn" data-task-id="${task.id}" title="Decrease target limit (−1)" ${!canDecrement ? 'disabled style="opacity: 0.35; cursor: not-allowed;"' : ''}>−</button>
            <span class="unified-pomo-badge ${isCompleted ? 'done' : ''}">
              🍅 <span class="pomo-numbers">${task.completedPomos || 0}/${task.targetPomos || 1}</span>
            </span>
            <button type="button" class="pomo-step-btn inc-pomo-btn" data-task-id="${task.id}" title="Increase target limit (+1)">+</button>
          </div>
        </div>
        <div class="unified-task-meta">
          ${isActive ? `
            <span class="active-focus-pill" title="Currently active session focus">
              <span class="pulse-dot"></span> 🎯 Focus
            </span>
          ` : `
            <button type="button" class="set-focus-btn" data-task-id="${task.id}" title="Make this the active focus task">🎯 Focus</button>
          `}
          <button type="button" class="unified-delete-btn" data-task-id="${task.id}" title="Delete task" aria-label="Delete task">&times;</button>
        </div>
      </div>
    `;
  }).join('');
}

function initTaskQueue() {
  const form = DOM.unifiedTaskForm || document.getElementById('unifiedTaskForm');
  const input = DOM.unifiedTaskInput || document.getElementById('unifiedTaskInput');
  const decBtn = DOM.inputTargetDecBtn || document.getElementById('inputTargetDecBtn');
  const incBtn = DOM.inputTargetIncBtn || document.getElementById('inputTargetIncBtn');
  const valDisplay = DOM.inputTargetVal || document.getElementById('inputTargetVal');
  const list = DOM.unifiedQueueList || DOM.taskQueueList || document.getElementById('unifiedQueueList');

  // Initial stepper controls for top input bar
  if (decBtn && incBtn && valDisplay) {
    decBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (initialTargetStepperCount > 1) {
        initialTargetStepperCount--;
        valDisplay.textContent = initialTargetStepperCount;
      }
    });
    incBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (initialTargetStepperCount < 10) {
        initialTargetStepperCount++;
        valDisplay.textContent = initialTargetStepperCount;
      }
    });
  }

  // Form submission (click + Add or press Enter)
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitNewTask();
    });
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitNewTask();
      }
    });
  }

  // Task list event delegation
  if (list) {
    list.addEventListener('click', (e) => {
      const target = e.target;
      const card = target.closest('.unified-task-card, .task-item');
      if (!card) return;
      const taskId = card.getAttribute('data-task-id');
      if (!taskId) return;

      const tasks = getTaskQueue();
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // 1. Checkbox toggle (mark complete/incomplete)
      if (target.classList.contains('unified-task-checkbox') || target.classList.contains('task-checkbox')) {
        task.completed = target.checked;
        if (task.completed) {
          playChimeSound('bell');
          showToast(`✅ "${task.title}" completed!`, 'success');
          // If the completed task was currently focused, advance to the next uncompleted task
          const wasActive = state.currentTask && state.currentTask.toLowerCase() === (task.title || task.text || '').toLowerCase();
          if (wasActive) {
            const nextTask = tasks.find(t => !t.completed && t.id !== task.id);
            state.currentTask = nextTask ? (nextTask.title || nextTask.text || '') : '';
            if (nextTask) {
              showToast(`🎯 Advanced focus to: "${nextTask.title || nextTask.text}"`, 'info');
            }
          }
        } else {
          showToast(`↩️ "${task.title}" marked in progress`, 'info');
          if (!state.currentTask) {
            state.currentTask = task.title || task.text || '';
          }
        }
        saveTaskQueue(tasks);
        return;
      }

      // 2. Delete button (✕)
      if (target.classList.contains('unified-delete-btn') || target.classList.contains('task-delete-btn')) {
        const wasActive = state.currentTask && state.currentTask.toLowerCase() === (task.title || task.text || '').toLowerCase();
        const updated = tasks.filter(t => t.id !== taskId);
        if (wasActive) {
          const nextTask = updated.find(t => !t.completed);
          state.currentTask = nextTask ? (nextTask.title || nextTask.text || '') : '';
        }
        saveTaskQueue(updated);
        showToast('Task removed from queue', 'info');
        return;
      }

      // 3. Target Pomodoro decrement (−)
      if (target.classList.contains('dec-pomo-btn') || target.classList.contains('dec-target')) {
        const minTarget = Math.max(1, task.completedPomos || 0);
        if (task.targetPomos > minTarget) {
          task.targetPomos--;
          if (task.completedPomos >= task.targetPomos) {
            task.completed = true;
          }
          saveTaskQueue(tasks);
          showToast(`🎯 Target updated: ${task.targetPomos} Pomos for "${task.title}"`, 'info');
        } else if (task.completedPomos > 0) {
          showToast(`Target cannot be lower than finished sessions (${task.completedPomos})`, 'warning');
        }
        return;
      }

      // 4. Target Pomodoro increment (+)
      if (target.classList.contains('inc-pomo-btn') || target.classList.contains('inc-target')) {
        if (task.targetPomos < 50) {
          task.targetPomos++;
          if (task.completedPomos < task.targetPomos) {
            task.completed = false;
          }
          saveTaskQueue(tasks);
          showToast(`🎯 Target updated: ${task.targetPomos} Pomos for "${task.title}"`, 'info');
        }
        return;
      }

      // 5. Select / Focus task
      if (target.classList.contains('set-focus-btn') || target.classList.contains('task-select-btn') || target.classList.contains('unified-task-title') || target.closest('.unified-task-info')) {
        if (!task.completed) {
          selectQueuedTask(task);
        }
      }
    });
  }

  renderTaskQueue();
}

function submitNewTask() {
  const input = DOM.unifiedTaskInput || DOM.currentTaskInput || document.getElementById('unifiedTaskInput');
  if (!input) return;
  const title = input.value.trim();
  if (!title) {
    showToast('Please enter what you are working on 🎯', 'warning');
    return;
  }

  const tasks = getTaskQueue();
  const targetCount = Math.max(1, parseInt(initialTargetStepperCount, 10) || 1);
  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title: title,
    text: title,
    targetPomos: targetCount,
    completedPomos: 0,
    completed: false,
    createdAt: new Date().toISOString()
  };

  tasks.push(newTask);

  // If no task is currently active or uncompleted, immediately set this new task as active
  const hasActiveIncomplete = tasks.some(t => !t.completed && (state.currentTask && t.title.toLowerCase() === state.currentTask.toLowerCase()));
  if (!hasActiveIncomplete || !state.currentTask) {
    state.currentTask = newTask.title;
  }

  saveTaskQueue(tasks);

  input.value = '';
  initialTargetStepperCount = 1;
  const valDisplay = DOM.inputTargetVal || document.getElementById('inputTargetVal');
  if (valDisplay) valDisplay.textContent = '1';

  showToast(`🎯 Added "${title}" (${targetCount} 🍅) to queue`, 'success');
}

function selectQueuedTask(task) {
  const taskName = task.title || task.text || '';
  state.currentTask = taskName;
  updateZenTaskDisplay();
  renderTaskQueue();
  showToast(`🎯 Active focus task: "${taskName}"`, 'info');
}

function incrementActiveTaskProgress() {
  const currentTaskName = (state.currentTask || (DOM.unifiedTaskInput ? DOM.unifiedTaskInput.value : '')).trim();
  const tasks = getTaskQueue();
  if (tasks.length === 0) return;

  // Match active task by name, or fallback to first uncompleted task
  let matchedTask = null;
  if (currentTaskName) {
    matchedTask = tasks.find(t => (t.title || t.text || '').trim().toLowerCase() === currentTaskName.toLowerCase() && !t.completed);
  }
  if (!matchedTask) {
    matchedTask = tasks.find(t => !t.completed);
  }

  if (matchedTask) {
    matchedTask.completedPomos = (matchedTask.completedPomos || 0) + 1;
    
    if (matchedTask.completedPomos >= matchedTask.targetPomos && !matchedTask.completed) {
      matchedTask.completed = true;
      triggerConfettiBurst();
      showToast(`🏆 Goal reached (${matchedTask.targetPomos}/${matchedTask.targetPomos} 🍅) for "${matchedTask.title || matchedTask.text}"!`, 'success');

      // Automatically advance to the next incomplete task in the queue
      const nextTask = tasks.find(t => !t.completed && t.id !== matchedTask.id);
      if (nextTask) {
        state.currentTask = nextTask.title || nextTask.text || '';
        showToast(`🎯 Advanced to next queued task: "${state.currentTask}"`, 'info');
      } else {
        state.currentTask = '';
      }
    } else {
      showToast(`🍅 Progress: ${matchedTask.completedPomos}/${matchedTask.targetPomos} Pomos for "${matchedTask.title || matchedTask.text}"`, 'info');
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

  // 1. Inherit active theme & dynamic CSS custom properties
  const activeTheme = document.body.getAttribute('data-theme') || 'pomodoro';
  cardContainer.setAttribute('data-theme', activeTheme);

  const computed = getComputedStyle(document.body);
  const themeProps = [
    '--bg-primary',
    '--bg-secondary',
    '--bg-card',
    '--bg-card-hover',
    '--accent-color',
    '--accent-secondary',
    '--accent-rgb',
    '--accent-glow',
    '--card-border',
    '--border-color',
    '--border-hover',
    '--badge-bg',
    '--text-primary',
    '--text-secondary',
    '--text-muted'
  ];

  themeProps.forEach(prop => {
    const val = computed.getPropertyValue(prop);
    if (val) {
      cardContainer.style.setProperty(prop, val.trim());
    }
  });

  const activeBgColor = (computed.getPropertyValue('--bg-primary') || '#171214').trim();

  // 2. Populate dynamic dates & user info
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

  // 3. Populate highlight metric pills from active stats with dynamic unit formatting
  const stats = state.currentStats || computeLocalStats();
  const totalHrsElem = document.getElementById('shareTotalHours');
  if (totalHrsElem) {
    const totalMinutes = stats.total_focus_minutes !== undefined 
      ? Math.round(parseFloat(stats.total_focus_minutes) || 0)
      : (stats.total_focus_hours ? Math.round(parseFloat(stats.total_focus_hours) * 60) : 0);

    let formattedTotal = '0m total';
    if (totalMinutes < 60) {
      formattedTotal = `${totalMinutes}m total`;
    } else {
      formattedTotal = `${(totalMinutes / 60).toFixed(1)} hrs total`;
    }
    totalHrsElem.textContent = formattedTotal;
  }

  const streakElem = document.getElementById('shareStreakDays');
  if (streakElem) {
    const streakVal = stats.current_streak_days !== undefined 
      ? parseInt(stats.current_streak_days, 10) || 0 
      : (DOM.statStreakDays ? parseInt(DOM.statStreakDays.textContent, 10) || 0 : 0);
    streakElem.textContent = streakVal === 1 ? '1 day' : `${streakVal} days`;
  }

  const todayMinElem = document.getElementById('shareTodayMinutes');
  if (todayMinElem) {
    const todayMinutes = stats.today_focus_minutes !== undefined 
      ? Math.round(parseFloat(stats.today_focus_minutes) || 0) 
      : (DOM.statTodayMinutes ? parseInt(DOM.statTodayMinutes.textContent, 10) || 0 : 0);

    let formattedToday = '0m today';
    if (todayMinutes < 60) {
      formattedToday = `${todayMinutes}m today`;
    } else {
      formattedToday = `${(todayMinutes / 60).toFixed(1)} hrs today`;
    }
    todayMinElem.textContent = formattedToday;
  }

  const compCountElem = document.getElementById('shareCompletedCount');
  if (compCountElem) {
    const compVal = stats.completed_pomodoros !== undefined 
      ? stats.completed_pomodoros 
      : (DOM.statCompletedCount ? DOM.statCompletedCount.textContent.trim() : '0');
    compCountElem.textContent = `${compVal} pomos`;
  }

  // 4. Populate weekly focus activity summary badge & 7-day single-row column chart (100% sync with live site)
  const activity = (state.currentStats && state.currentStats.weekly_activity) || state.currentActivity || stats.weekly_activity || [];
  const totalWeeklyMins = activity.reduce((acc, d) => acc + (parseFloat(d.focus_minutes) || 0), 0);
  const weeklyHours = (totalWeeklyMins / 60).toFixed(1);

  const weekTotalElem = document.getElementById('shareWeekTotal');
  if (weekTotalElem) {
    weekTotalElem.textContent = `${weeklyHours}h this week`;
  }

  const chartContentElem = document.getElementById('shareChartContent');
  if (chartContentElem) {
    const activity = (state.currentStats && state.currentStats.weekly_activity) || state.currentActivity || stats.weekly_activity || [];
    const todayStr = getLocalDateString();
    const recordedMins = activity.map(a => parseFloat(a.focus_minutes) || 0);
    const totalWeeklyMins = recordedMins.reduce((acc, m) => acc + m, 0);
    const maxMins = Math.max(...recordedMins, 25);

    // Motivational subtitle for low weekly focus (< 15 mins)
    const chartSubElem = document.getElementById('shareChartSubtitle');
    if (chartSubElem) {
      if (totalWeeklyMins < 15) {
        chartSubElem.textContent = '🌱 Planting your focus seeds — keep going!';
        chartSubElem.style.display = 'block';
      } else {
        chartSubElem.style.display = 'none';
      }
    }

    let chartHtml = '<div class="share-chart-row">';
    activity.forEach(item => {
      const mins = parseFloat(item.focus_minutes) || 0;
      const count = parseInt(item.completed_count, 10) || 0;
      const isToday = item.date === todayStr;

      let heightPercent = 0;
      let minHeight = '0px';
      let fillOpacity = 0.25;
      if (mins > 0) {
        heightPercent = Math.min(100, Math.max(8, Math.round((mins / maxMins) * 100)));
        minHeight = '8px';
        fillOpacity = 1;
      }

      const badgeContent = count > 0 ? `🍅 ${count}` : '&nbsp;';

      chartHtml += `
        <div class="share-day-col ${isToday ? 'today' : ''}">
          <div class="share-bar-badge ${count > 0 ? 'active' : ''}">${badgeContent}</div>
          <div class="share-bar-track">
            <div class="share-bar-fill" style="height: ${heightPercent}%; min-height: ${minHeight}; opacity: ${fillOpacity};"></div>
          </div>
          <span class="share-day-label">${item.day_name}</span>
        </div>
      `;
    });
    chartHtml += '</div>';
    chartContentElem.innerHTML = chartHtml;
  }

  // 5. Temporarily show container for capture (position off-screen)
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
      backgroundColor: activeBgColor,
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

document.addEventListener('DOMContentLoaded', async () => {
  if (DOM.progressCircle) {
    DOM.progressCircle.style.strokeDasharray = CIRCUMFERENCE;
  }

  setupEventListeners();
  loadStoredSettings();
  initTaskQueue();

  // 1. Immediately populate stat cards, charts, and badges from cache to eliminate 0-stat flash
  loadCachedStats();

  // Restore saved cycle, mode, timer state, and render UI ONCE
  restoreTimerFromStorage();

  // Check auth session, init Google Sign-In & load authoritative stats from database
  await checkAuthStatus();
  initGoogleSignIn();
  await fetchStatistics();

  // Check for first-time user tour & pulse
  checkFirstTimeUser();
});
