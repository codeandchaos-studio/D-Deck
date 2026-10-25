export type TaskCategory = string;

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskMeta {
  rating?: number; // 1 to 5 stars for movies/games
  status?: 'planned' | 'in-progress' | 'completed' | 'dropped';
  platform?: string; // PC, Steam, PS5, Web, Mac
  link?: string; // repo, doc, or streaming link
  tag?: string;
}

export interface ReminderStages {
  pre1?: boolean;  // 1 minute before
  exact?: boolean; // at the exact time
  post1?: boolean; // legacy
  lastMinuteNotified?: number; // Minutes overdue that was last notified (+1m, +2m, +3m...)
  pre5?: boolean;
  post5?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category?: TaskCategory;
  priority: TaskPriority;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (e.g. 11:30)
  durationDays?: number; // How many days task lasts
  isRoutine?: boolean; // Daily Routine: automatically resets at midnight
  lastResetDate?: string; // Track day of last routine reset (YYYY-MM-DD)
  reminderEnabled: boolean;
  soundEnabled?: boolean; // Individual task reminder audio toggle (default true)
  reminderStages?: ReminderStages;
  subtasks: Subtask[];
  meta?: TaskMeta;
}

export interface AppSettings {
  startupOnBoot: boolean;
  alwaysOnTop: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  customSoundPath?: string; // Local audio file path on user machine
  widgetOpacity: number;
  widgetWidth?: number; // User-customized horizontal width
  widgetX?: number;
  widgetY?: number;
  deckX?: number;
  deckY?: number;
}

export interface StreakMetrics {
  currentStreak: number;
  bestStreak: number;
  lastActiveDate?: string; // YYYY-MM-DD
  totalCompleted: number;
  weeklyVelocity: number; // completed tasks in last 7 days
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string;
  installerUrl?: string;
  portableUrl?: string;
}

export interface DeckData {
  tasks: Task[];
  settings: AppSettings;
  streak?: StreakMetrics;
}

export type ViewMode = 'widget' | 'deck';

export interface ElectronAPI {
  getDeckData: () => Promise<DeckData>;
  saveDeckData: (data: DeckData) => Promise<boolean>;
  setWindowMode: (mode: ViewMode) => Promise<void>;
  getWindowMode: () => Promise<ViewMode>;
  setAlwaysOnTop: (flag: boolean) => Promise<void>;
  setStartupOnBoot: (flag: boolean) => Promise<boolean>;
  showNotification: (title: string, body: string, options?: { silent?: boolean }) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  savePosition: (mode: ViewMode, x: number, y: number) => Promise<void>;
  setWidgetHeight?: (height: number) => Promise<void>;
  selectCustomSound?: () => Promise<string | null>;
  checkForUpdates?: (manual?: boolean) => Promise<UpdateInfo>;
  onUpdateAvailable?: (callback: (info: UpdateInfo) => void) => () => void;
  openPatchNotice?: () => Promise<void>;
  closePatchNotice?: () => Promise<void>;
  openQuickAdd?: (category?: string) => Promise<void>;
  closeQuickAdd?: () => Promise<void>;
  onDataUpdated?: (callback: (data: DeckData) => void) => () => void;
  onReminderSound?: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
