import { app, BrowserWindow, ipcMain, Notification, Tray, Menu, shell, screen, nativeImage, globalShortcut, nativeTheme, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { spawn } from 'child_process';
import type { DeckData, ViewMode, UpdateInfo } from '../src/types';

let mainWindow: BrowserWindow | null = null;
let quickAddWindow: BrowserWindow | null = null;
let patchNoticeWindow: BrowserWindow | null = null;
let editTaskWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentMode: ViewMode = 'widget';
let reminderIntervalTimer: NodeJS.Timeout | null = null;
let isQuitting = false;

let downloadedUpdatePath: string | null = null;
let isDownloadingUpdate = false;

const WIDGET_WIDTH = 280;
const WIDGET_DEFAULT_HEIGHT = 160;
const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 540;
const PATCH_WINDOW_WIDTH = 540;
const PATCH_WINDOW_HEIGHT = 460;
const EDIT_TASK_WINDOW_WIDTH = 480;
const EDIT_TASK_WINDOW_HEIGHT = 640;
const DECK_WIDTH = 1080;
const DECK_HEIGHT = 740;

const DATA_FILE_PATH = path.join(app.getPath('userData'), 'd-deck-data.json');

// Default initial storage - clean empty slate
const DEFAULT_DECK_DATA: DeckData = {
  tasks: [],
  settings: {
    startupOnBoot: true,
    alwaysOnTop: true,
    notificationsEnabled: true,
    soundEnabled: true,
    widgetOpacity: 0.95,
  }
};

function getTrayIconPath(): string {
  const candidates = [
    path.join(process.resourcesPath, 'public', 'icon.ico'),
    path.join(process.resourcesPath, 'public', 'icon.png'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(app.getAppPath(), 'public', 'icon.ico'),
    path.join(app.getAppPath(), 'public', 'icon.png'),
    path.join(app.getAppPath(), 'dist', 'icon.ico'),
    path.join(app.getAppPath(), 'dist', 'icon.png'),
    path.join(__dirname, '..', '..', 'public', 'icon.ico'),
    path.join(__dirname, '..', '..', 'public', 'icon.png'),
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return '';
}

function readDeckData(): DeckData {
  try {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      fs.mkdirSync(path.dirname(DATA_FILE_PATH), { recursive: true });
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(DEFAULT_DECK_DATA, null, 2), 'utf-8');
      return DEFAULT_DECK_DATA;
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DECK_DATA,
      ...parsed,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      settings: { ...DEFAULT_DECK_DATA.settings, ...parsed.settings }
    };
  } catch (err) {
    console.error('Failed reading data:', err);
    return DEFAULT_DECK_DATA;
  }
}

function writeDeckData(data: DeckData): boolean {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE_PATH), { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed writing data:', err);
    return false;
  }
}

function showSystemNotification(title: string, body: string, silent: boolean = false) {
  if (!Notification.isSupported()) return;
  const iconPath = getTrayIconPath();
  const notification = new Notification({
    title,
    body,
    icon: iconPath || undefined,
    silent
  });
  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  notification.show();
}

// 3-Stage & Minute-by-Minute Persistent Reminder Engine:
// Stage 1: 1 minute before scheduled time (T - 1m)
// Stage 2: Exact scheduled time (T)
// Stage 3: After every minute while task is pending (T + 1m, T + 2m, T + 3m...)
function checkThreeStageReminders() {
  const data = readDeckData();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let changed = false;

  // Protocol Auto-Reset Engine: Daily & Weekly recurring reset logic
  const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  for (const task of data.tasks) {
    if (task.isRoutine) {
      let shouldReset = false;

      if (task.protocolType === 'weekly' && Array.isArray(task.protocolDays) && task.protocolDays.length > 0) {
        // Weekly protocol: Check if today is one of the active protocol days and hasn't reset yet today
        if (task.protocolDays.includes(currentDayOfWeek) && task.lastResetDate !== todayStr) {
          shouldReset = true;
        }
      } else {
        // Daily protocol: Reset if day changed
        const lastDay = task.lastResetDate || (task.completedAt ? task.completedAt.split('T')[0] : task.dueDate);
        if (lastDay && lastDay < todayStr) {
          shouldReset = true;
        }
      }

      if (shouldReset) {
        if (!task.completed) {
          task.streak = 0;
        }
        task.completed = false;
        task.completedAt = undefined;
        task.lastResetDate = todayStr;
        task.dueDate = todayStr;
        task.reminderStages = {};
        if (Array.isArray(task.subtasks)) {
          for (const st of task.subtasks) {
            st.completed = false;
          }
        }
        changed = true;
      }
    }
  }

  if (changed) {
    writeDeckData(data);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('deck:data-updated', data);
    }
  }

  // Check Zen Focus Shield: Mute notifications and chimes during Zen mode
  const isZenActive = !!(data.settings.zenUntil && data.settings.zenUntil > now.getTime());
  if (isZenActive || !data.settings.notificationsEnabled) {
    return;
  }

  for (const task of data.tasks) {
    if (task.completed || !task.reminderEnabled || !task.dueDate) continue;

    // Time-based continuous reminders
    if (task.dueTime) {
      const [y, m, d] = task.dueDate.split('-').map(Number);
      const [hh, mm] = task.dueTime.split(':').map(Number);
      if (isNaN(y) || isNaN(m) || isNaN(d) || isNaN(hh) || isNaN(mm)) continue;

      const targetDate = new Date(y, m - 1, d, hh, mm, 0);
      const diffSec = Math.round((targetDate.getTime() - now.getTime()) / 1000);

      if (!task.reminderStages) {
        task.reminderStages = {};
      }

      // Stage 1: 1 minute before (diffSec between 20s and 70s)
      if (diffSec <= 70 && diffSec >= 20 && !task.reminderStages.pre1) {
        task.reminderStages.pre1 = true;
        changed = true;
        showSystemNotification(
          'D-Deck (Upcoming in 1m)',
          `Scheduled at ${task.dueTime}: "${task.title}"`
        );
        if (mainWindow && !mainWindow.isDestroyed() && data.settings.soundEnabled && task.soundEnabled !== false) {
          mainWindow.webContents.send('deck:play-reminder-sound');
        }
      }

      // Stage 2: Exact due time (diffSec between -35s and 15s)
      if (diffSec <= 15 && diffSec >= -35 && !task.reminderStages.exact) {
        task.reminderStages.exact = true;
        changed = true;
        showSystemNotification(
          'D-Deck Reminder',
          `Time for: "${task.title}" (${task.dueTime})`
        );
        if (mainWindow && !mainWindow.isDestroyed() && data.settings.soundEnabled && task.soundEnabled !== false) {
          mainWindow.webContents.send('deck:play-reminder-sound');
        }
      }

      // Stage 3: After every minute if still not marked completed (1m, 2m, 3m...)
      if (diffSec <= -45 && !task.completed) {
        const elapsedMinutes = Math.floor(Math.abs(diffSec) / 60);
        if (elapsedMinutes >= 1 && task.reminderStages.lastMinuteNotified !== elapsedMinutes) {
          task.reminderStages.lastMinuteNotified = elapsedMinutes;
          task.reminderStages.post1 = true;
          changed = true;
          showSystemNotification(
            `D-Deck Reminder (+${elapsedMinutes}m)`,
            `"${task.title}" is pending (${elapsedMinutes}m overdue). Click to mark done!`
          );
          if (mainWindow && !mainWindow.isDestroyed() && data.settings.soundEnabled && task.soundEnabled !== false) {
            mainWindow.webContents.send('deck:play-reminder-sound');
          }
        }
      }
    }
  }

  if (changed) {
    writeDeckData(data);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('deck:data-updated', data);
    }
  }
}

function checkStartupAgenda() {
  const data = readDeckData();
  if (!data.settings.notificationsEnabled) return;

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = data.tasks.filter(t => !t.completed && t.dueDate && t.dueDate < today);
  const dueTodayTasks = data.tasks.filter(t => !t.completed && t.dueDate === today);

  if (overdueTasks.length > 0) {
    const taskSample = overdueTasks.slice(0, 2).map(t => `"${t.title}"`).join(', ');
    showSystemNotification(
      'D-Deck Attention',
      `${overdueTasks.length} task(s) are overdue: ${taskSample}`
    );
  } else if (dueTodayTasks.length > 0) {
    showSystemNotification(
      'D-Deck Agenda',
      `You have ${dueTodayTasks.length} task(s) scheduled for today.`
    );
  }
}

function startReminderLoop() {
  if (reminderIntervalTimer) clearInterval(reminderIntervalTimer);

  // Monitor reminders every 5 seconds for pinpoint ±1m accuracy
  reminderIntervalTimer = setInterval(() => {
    checkThreeStageReminders();
  }, 5 * 1000);
}

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const savedData = readDeckData();
  const savedX = savedData.settings.widgetX;
  const savedY = savedData.settings.widgetY;
  const widgetWidth = savedData.settings.widgetWidth ?? WIDGET_WIDTH;

  // Restore saved position or default to top-right
  const initialX = (savedX !== undefined && savedX >= 0 && savedX < screenWidth)
    ? savedX
    : screenWidth - widgetWidth - 24;
  const initialY = (savedY !== undefined && savedY >= 0 && savedY < screenHeight)
    ? savedY
    : 48;

  const appIconPath = path.join(app.getAppPath(), 'public', 'icon.png');

  mainWindow = new BrowserWindow({
    title: '',
    width: widgetWidth,
    height: WIDGET_DEFAULT_HEIGHT,
    minWidth: 240,
    maxWidth: 650,
    minHeight: 120,
    maxHeight: 650,
    resizable: true,
    x: initialX,
    y: initialY,
    icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    roundedCorners: true,
    hasShadow: false,
    autoHideMenuBar: true,
    alwaysOnTop: savedData.settings.alwaysOnTop ?? true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow?.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  // Persist window position permanently whenever the user moves it
  mainWindow.on('moved', () => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    const data = readDeckData();
    if (currentMode === 'widget') {
      data.settings.widgetX = x;
      data.settings.widgetY = y;
    } else {
      data.settings.deckX = x;
      data.settings.deckY = y;
    }
    writeDeckData(data);
  });

  // Persist user-adjusted widget width permanently on drag
  mainWindow.on('resize', () => {
    if (!mainWindow) return;
    if (currentMode === 'widget') {
      const [w] = mainWindow.getSize();
      const data = readDeckData();
      if (data.settings.widgetWidth !== w && w >= 240 && w <= 650) {
        data.settings.widgetWidth = w;
        writeDeckData(data);
      }
    }
  });

  // Hide to system tray instead of terminating when close is clicked
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      if (quickAddWindow && !quickAddWindow.isDestroyed()) {
        quickAddWindow.close();
      }
      if (patchNoticeWindow && !patchNoticeWindow.isDestroyed()) {
        patchNoticeWindow.close();
      }
      if (editTaskWindow && !editTaskWindow.isDestroyed()) {
        editTaskWindow.close();
      }
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createQuickAddWindow(category: string = 'coding') {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    if (quickAddWindow.isMinimized()) quickAddWindow.restore();
    quickAddWindow.show();
    quickAddWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  let x = Math.floor((screenWidth - POPUP_WIDTH) / 2);
  let y = Math.floor((screenHeight - POPUP_HEIGHT) / 2);

  if (mainWindow && !mainWindow.isDestroyed()) {
    const [wx, wy] = mainWindow.getPosition();
    if (wx > screenWidth / 2) {
      x = Math.max(16, wx - POPUP_WIDTH - 12);
    } else {
      x = Math.min(screenWidth - POPUP_WIDTH - 16, wx + WIDGET_WIDTH + 12);
    }
    y = Math.max(24, Math.min(wy, screenHeight - POPUP_HEIGHT - 24));
  }

  const appIconPath = path.join(app.getAppPath(), 'public', 'icon.png');

  quickAddWindow = new BrowserWindow({
    title: '',
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    x,
    y,
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    roundedCorners: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    autoHideMenuBar: true,
    icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    }
  });

  quickAddWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    quickAddWindow.loadURL(`http://localhost:5173/#quick-add?cat=${encodeURIComponent(category)}`).catch(() => {
      quickAddWindow?.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { hash: `quick-add?cat=${encodeURIComponent(category)}` });
    });
  } else {
    quickAddWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { hash: `quick-add?cat=${encodeURIComponent(category)}` });
  }

  quickAddWindow.on('closed', () => {
    quickAddWindow = null;
  });
}

function createPatchNoticeWindow() {
  if (patchNoticeWindow && !patchNoticeWindow.isDestroyed()) {
    if (patchNoticeWindow.isMinimized()) patchNoticeWindow.restore();
    patchNoticeWindow.show();
    patchNoticeWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const x = Math.floor((screenWidth - PATCH_WINDOW_WIDTH) / 2);
  const y = Math.floor((screenHeight - PATCH_WINDOW_HEIGHT) / 2);

  const appIconPath = path.join(app.getAppPath(), 'public', 'icon.png');

  patchNoticeWindow = new BrowserWindow({
    title: '',
    width: PATCH_WINDOW_WIDTH,
    height: PATCH_WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    roundedCorners: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    autoHideMenuBar: true,
    icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    }
  });

  patchNoticeWindow.setMenuBarVisibility(false);

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    patchNoticeWindow.loadURL('http://localhost:5173/#patch-notice').catch(() => {
      patchNoticeWindow?.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { hash: 'patch-notice' });
    });
  } else {
    patchNoticeWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { hash: 'patch-notice' });
  }

  patchNoticeWindow.on('closed', () => {
    patchNoticeWindow = null;
  });
}

function createEditTaskWindow(taskId: string) {
  if (editTaskWindow && !editTaskWindow.isDestroyed()) {
    if (editTaskWindow.isMinimized()) editTaskWindow.restore();
    editTaskWindow.show();
    editTaskWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  let x = Math.floor((screenWidth - EDIT_TASK_WINDOW_WIDTH) / 2);
  let y = Math.floor((screenHeight - EDIT_TASK_WINDOW_HEIGHT) / 2);

  if (mainWindow && !mainWindow.isDestroyed() && currentMode === 'widget') {
    const [wx, wy] = mainWindow.getPosition();
    if (wx > screenWidth / 2) {
      x = Math.max(16, wx - EDIT_TASK_WINDOW_WIDTH - 12);
    } else {
      x = Math.min(screenWidth - EDIT_TASK_WINDOW_WIDTH - 16, wx + WIDGET_WIDTH + 12);
    }
    y = Math.max(24, Math.min(wy, screenHeight - EDIT_TASK_WINDOW_HEIGHT - 24));
  }

  const appIconPath = path.join(app.getAppPath(), 'public', 'icon.png');

  editTaskWindow = new BrowserWindow({
    title: '',
    width: EDIT_TASK_WINDOW_WIDTH,
    height: EDIT_TASK_WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: false,
    backgroundMaterial: 'acrylic',
    roundedCorners: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: true,
    autoHideMenuBar: true,
    icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    }
  });

  editTaskWindow.setMenuBarVisibility(false);

  const hashPath = `edit-task?id=${encodeURIComponent(taskId)}`;
  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    editTaskWindow.loadURL(`http://localhost:5173/#${hashPath}`).catch(() => {
      editTaskWindow?.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { hash: hashPath });
    });
  } else {
    editTaskWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'), { hash: hashPath });
  }

  editTaskWindow.on('closed', () => {
    editTaskWindow = null;
  });
}

function setupTray() {
  const iconPath = getTrayIconPath();
  if (iconPath) {
    if (process.platform === 'win32' && iconPath.endsWith('.ico')) {
      tray = new Tray(iconPath);
    } else {
      const img = nativeImage.createFromPath(iconPath);
      tray = new Tray(img.resize({ width: 16, height: 16 }));
    }
  } else {
    tray = new Tray(nativeImage.createEmpty());
  }

  tray.setToolTip('D-Deck');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open D-Deck Widget',
      click: () => {
        if (mainWindow) {
          setWindowMode('widget');
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Add New Task (+)',
      click: () => createQuickAddWindow()
    },
    { type: 'separator' },
    {
      label: 'Switch to Full View',
      click: () => {
        setWindowMode('deck');
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Switch to Widget',
      click: () => {
        setWindowMode('widget');
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit D-Deck',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      if (currentMode === 'widget') {
        mainWindow.setSkipTaskbar(true);
      }
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('double-click', () => {
    if (!mainWindow) return;
    if (currentMode === 'widget') {
      mainWindow.setSkipTaskbar(true);
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  });
}

function setWindowMode(mode: ViewMode) {
  if (!mainWindow) return;
  currentMode = mode;
  mainWindow.setTitle('');

  const data = readDeckData();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  if (mode === 'widget') {
    mainWindow.setSkipTaskbar(true);
    mainWindow.setAlwaysOnTop(data.settings.alwaysOnTop ?? true);
    const targetW = data.settings.widgetWidth ?? WIDGET_WIDTH;
    mainWindow.setMinimumSize(240, 120);
    mainWindow.setMaximumSize(650, 650);
    mainWindow.setSize(targetW, WIDGET_DEFAULT_HEIGHT, false);

    const x = data.settings.widgetX ?? Math.min(mainWindow.getPosition()[0], screenWidth - targetW - 20);
    const y = data.settings.widgetY ?? Math.min(mainWindow.getPosition()[1], screenHeight - WIDGET_DEFAULT_HEIGHT - 20);
    mainWindow.setPosition(x, y, false);
  } else {
    mainWindow.setMinimumSize(800, 600);
    mainWindow.setMaximumSize(3840, 2160);
    mainWindow.setSkipTaskbar(false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSize(DECK_WIDTH, DECK_HEIGHT, true);

    const x = data.settings.deckX ?? Math.max(0, Math.floor((screenWidth - DECK_WIDTH) / 2));
    const y = data.settings.deckY ?? Math.max(0, Math.floor((screenHeight - DECK_HEIGHT) / 2));
    mainWindow.setPosition(x, y, true);
  }
}

function getCurrentVersion(): string {
  try {
    return app.getVersion() || '2.0.0';
  } catch {
    return '2.0.0';
  }
}

function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '').replace(/^v/, '').trim();
  const clean2 = (v2 || '').replace(/^v/, '').trim();
  const p1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

function fetchLatestRelease(): Promise<UpdateInfo> {
  const currentVersion = getCurrentVersion();
  const repo = 'codeandchaos-studio/D-Deck';
  const url = `https://api.github.com/repos/${repo}/releases/latest`;

  return new Promise((resolve) => {
    function handleError() {
      resolve({
        available: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseName: '',
        releaseNotes: '',
        publishedAt: '',
        downloadUrl: `https://github.com/${repo}/releases/latest`
      });
    }

    function handleResponse(response: any) {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        https.get(response.headers.location, {
          headers: {
            'User-Agent': 'D-Deck-App',
            'Accept': 'application/vnd.github.v3+json'
          }
        }, handleResponse).on('error', handleError);
        return;
      }

      let data = '';
      response.on('data', (chunk: any) => { data += chunk; });
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) {
            handleError();
            return;
          }

          const parsed = JSON.parse(data);
          const latestVersion = (parsed.tag_name || '').replace(/^v/, '');
          const isNewer = compareSemver(latestVersion, currentVersion) > 0;

          let installerUrl = '';
          let portableUrl = '';
          if (Array.isArray(parsed.assets)) {
            for (const asset of parsed.assets) {
              const name = (asset.name || '').toLowerCase();
              if (name.includes('setup') && name.endsWith('.exe')) {
                installerUrl = asset.browser_download_url;
              } else if (name.includes('portable') && name.endsWith('.exe')) {
                portableUrl = asset.browser_download_url;
              }
            }
          }

          resolve({
            available: isNewer,
            currentVersion,
            latestVersion,
            releaseName: parsed.name || `D-Deck v${latestVersion}`,
            releaseNotes: parsed.body || 'New enhancements and stability improvements.',
            publishedAt: parsed.published_at || new Date().toISOString(),
            downloadUrl: parsed.html_url || `https://github.com/${repo}/releases/latest`,
            installerUrl: installerUrl || parsed.html_url,
            portableUrl: portableUrl || parsed.html_url
          });
        } catch {
          handleError();
        }
      });
    }

    const req = https.get(url, {
      headers: {
        'User-Agent': 'D-Deck-App',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, handleResponse);

    req.on('error', handleError);
    req.setTimeout(8000, () => {
      req.destroy();
      handleError();
    });
  });
}

function broadcastUpdateProgress(progress: any) {
  if (patchNoticeWindow && !patchNoticeWindow.isDestroyed()) {
    patchNoticeWindow.webContents.send('deck:update-download-progress', progress);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deck:update-download-progress', progress);
  }
}

function broadcastUpdateComplete(filePath: string) {
  if (patchNoticeWindow && !patchNoticeWindow.isDestroyed()) {
    patchNoticeWindow.webContents.send('deck:update-download-complete', { filePath });
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deck:update-download-complete', { filePath });
  }
}

function broadcastUpdateError(errMsg: string) {
  if (patchNoticeWindow && !patchNoticeWindow.isDestroyed()) {
    patchNoticeWindow.webContents.send('deck:update-download-error', errMsg);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deck:update-download-error', errMsg);
  }
}

function downloadFileWithRedirects(initialUrl: string, targetPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let transferred = 0;
    let total = 0;
    const startTime = Date.now();
    let fileStream: fs.WriteStream | null = null;

    function request(url: string, redirectCount = 0) {
      if (redirectCount > 8) {
        return reject(new Error('Too many redirects while downloading update file'));
      }

      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'D-Deck-App-Updater',
          'Accept': 'application/octet-stream, application/vnd.github.v3+json, */*'
        }
      };

      const req = https.get(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return request(res.headers.location, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Server returned status code ${res.statusCode}`));
        }

        total = parseInt(res.headers['content-length'] || '0', 10);
        fileStream = fs.createWriteStream(targetPath);

        let lastBroadcastTime = 0;

        res.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          fileStream?.write(chunk);

          const now = Date.now();
          if (now - lastBroadcastTime > 250 || transferred === total) {
            lastBroadcastTime = now;
            const elapsedSec = (now - startTime) / 1000 || 1;
            const speed = Math.round(transferred / elapsedSec);
            const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;
            broadcastUpdateProgress({
              percent,
              transferredBytes: transferred,
              totalBytes: total,
              speedBytesPerSec: speed,
            });
          }
        });

        res.on('end', () => {
          fileStream?.end(() => {
            resolve(targetPath);
          });
        });

        res.on('error', (err) => {
          fileStream?.close();
          try { fs.unlinkSync(targetPath); } catch {}
          reject(err);
        });
      });

      req.on('error', (err) => {
        reject(err);
      });
    }

    request(initialUrl);
  });
}

// IPC Handlers
ipcMain.handle('deck:get-data', () => readDeckData());
ipcMain.handle('deck:save-data', (_, data: DeckData) => {
  const ok = writeDeckData(data);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deck:data-updated', data);
  }
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close();
  }
  if (editTaskWindow && !editTaskWindow.isDestroyed()) {
    editTaskWindow.close();
  }
  return ok;
});
ipcMain.handle('window:open-quick-add', (_, category?: string) => {
  createQuickAddWindow(category || 'coding');
});
ipcMain.handle('window:close-quick-add', () => {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close();
  }
});
ipcMain.handle('window:open-patch-notice', () => {
  createPatchNoticeWindow();
});
ipcMain.handle('window:close-patch-notice', () => {
  if (patchNoticeWindow && !patchNoticeWindow.isDestroyed()) {
    patchNoticeWindow.close();
  }
});
ipcMain.handle('window:open-edit-task', (_, taskId: string) => {
  createEditTaskWindow(taskId);
});
ipcMain.handle('window:close-edit-task', () => {
  if (editTaskWindow && !editTaskWindow.isDestroyed()) {
    editTaskWindow.close();
  }
});
ipcMain.handle('window:set-mode', (_, mode: ViewMode) => setWindowMode(mode));
ipcMain.handle('window:get-mode', () => currentMode);
ipcMain.handle('window:set-widget-height', (_, height: number) => {
  if (!mainWindow || currentMode !== 'widget') return;
  const clampedHeight = Math.max(120, Math.min(540, Math.ceil(height)));
  const [currentW, currentH] = mainWindow.getSize();
  if (Math.abs(currentH - clampedHeight) < 2) return;

  const [x, y] = mainWindow.getPosition();
  const display = screen.getDisplayNearestPoint({ x, y });
  const maxY = display.workArea.y + display.workArea.height;
  let targetY = y;
  if (targetY + clampedHeight > maxY) {
    targetY = Math.max(display.workArea.y, maxY - clampedHeight);
  }

  // Preserve user-dragged width currentW instead of resetting to hardcoded 280
  mainWindow.setSize(currentW, clampedHeight, false);
  if (targetY !== y) {
    mainWindow.setPosition(x, targetY, false);
  }
});
ipcMain.handle('app:select-custom-sound', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Custom Notification Audio',
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});
ipcMain.handle('app:check-for-updates', async () => {
  return await fetchLatestRelease();
});
ipcMain.handle('app:start-update-download', async (_, customUrl?: string) => {
  if (isDownloadingUpdate) return true;

  try {
    let targetUrl = customUrl;
    if (!targetUrl || targetUrl.includes('releases/latest')) {
      const releaseInfo = await fetchLatestRelease();
      targetUrl = releaseInfo.installerUrl || releaseInfo.downloadUrl;
    }

    if (!targetUrl) {
      throw new Error('Unable to resolve update download URL');
    }

    isDownloadingUpdate = true;
    const tempInstallerPath = path.join(app.getPath('temp'), 'D-Deck-Update-Setup.exe');
    if (fs.existsSync(tempInstallerPath)) {
      try { fs.unlinkSync(tempInstallerPath); } catch {}
    }

    downloadFileWithRedirects(targetUrl, tempInstallerPath)
      .then((savedPath) => {
        downloadedUpdatePath = savedPath;
        isDownloadingUpdate = false;
        broadcastUpdateComplete(savedPath);
      })
      .catch((err) => {
        isDownloadingUpdate = false;
        broadcastUpdateError(err.message || 'Failed to download update');
      });

    return true;
  } catch (err: any) {
    isDownloadingUpdate = false;
    broadcastUpdateError(err.message || 'Failed to start download');
    return false;
  }
});
ipcMain.handle('app:apply-update-and-restart', () => {
  const updateExe = downloadedUpdatePath || path.join(app.getPath('temp'), 'D-Deck-Update-Setup.exe');
  if (!fs.existsSync(updateExe)) {
    throw new Error('Update installer file not found on disk');
  }

  isQuitting = true;

  const child = spawn(updateExe, [], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  app.quit();
});
ipcMain.handle('app:set-zen-mode', (_, zenUntil: number | null) => {
  const data = readDeckData();
  data.settings.zenUntil = zenUntil;
  writeDeckData(data);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deck:data-updated', data);
  }
  return true;
});
ipcMain.handle('app:snooze-task', (_, taskId: string, minutes: number) => {
  const data = readDeckData();
  const task = data.tasks.find(t => t.id === taskId);
  if (!task) return false;

  const now = new Date();
  const snoozedDate = new Date(now.getTime() + minutes * 60 * 1000);
  const hh = String(snoozedDate.getHours()).padStart(2, '0');
  const mm = String(snoozedDate.getMinutes()).padStart(2, '0');
  task.dueTime = `${hh}:${mm}`;
  task.dueDate = snoozedDate.toISOString().split('T')[0];
  task.reminderStages = {}; // Reset reminder flags so alert sounds when new time arrives

  writeDeckData(data);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('deck:data-updated', data);
  }
  return true;
});
ipcMain.handle('window:set-always-on-top', (_, flag: boolean) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(flag);
});
ipcMain.handle('app:set-startup', (_, flag: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: flag,
    path: process.execPath,
    args: ['--autostart']
  });
  return true;
});
ipcMain.handle('app:notify', (_, title: string, body: string, options?: { silent?: boolean }) => {
  showSystemNotification(title, body, options?.silent ?? false);
});
ipcMain.handle('window:minimize', () => {
  if (currentMode === 'widget') {
    mainWindow?.hide();
  } else {
    mainWindow?.minimize();
  }
});
ipcMain.handle('window:close', () => {
  if (quickAddWindow && !quickAddWindow.isDestroyed()) {
    quickAddWindow.close();
  }
  mainWindow?.hide();
});
ipcMain.handle('app:open-external', (_, url: string) => shell.openExternal(url));
ipcMain.handle('window:save-position', (_, mode: ViewMode, x: number, y: number) => {
  const data = readDeckData();
  if (mode === 'widget') {
    data.settings.widgetX = x;
    data.settings.widgetY = y;
  } else {
    data.settings.deckX = x;
    data.settings.deckY = y;
  }
  writeDeckData(data);
});

// App Lifecycle
app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  Menu.setApplicationMenu(null);
  createMainWindow();
  setupTray();
  checkStartupAgenda();
  startReminderLoop();

  // Non-blocking background check for new updates
  setTimeout(async () => {
    try {
      const updateInfo = await fetchLatestRelease();
      if (updateInfo.available) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('deck:update-available', updateInfo);
        }
        if (currentMode === 'widget') {
          createPatchNoticeWindow();
        }
      }
    } catch {}
  }, 6000);

  // Global Stealth Hotkey: Ctrl+Shift+D toggles HUD over any game or editor
  try {
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      if (!mainWindow) {
        createMainWindow();
        return;
      }

      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        setWindowMode('widget');
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(true);
      }
    });
  } catch (err) {
    console.error('Failed to register global hotkey:', err);
  }

  const initialData = readDeckData();
  if (initialData.settings.startupOnBoot) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: process.execPath,
      args: ['--autostart']
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (isQuitting) {
    app.quit();
  }
});

