import { contextBridge, ipcRenderer } from 'electron';
import type { DeckData, ViewMode } from '../src/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getDeckData: () => ipcRenderer.invoke('deck:get-data'),
  saveDeckData: (data: DeckData) => ipcRenderer.invoke('deck:save-data', data),
  setWindowMode: (mode: ViewMode) => ipcRenderer.invoke('window:set-mode', mode),
  getWindowMode: () => ipcRenderer.invoke('window:get-mode'),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:set-always-on-top', flag),
  setStartupOnBoot: (flag: boolean) => ipcRenderer.invoke('app:set-startup', flag),
  showNotification: (title: string, body: string, options?: { silent?: boolean }) => 
    ipcRenderer.invoke('app:notify', title, body, options),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  savePosition: (mode: ViewMode, x: number, y: number) => ipcRenderer.invoke('window:save-position', mode, x, y),
  setWidgetHeight: (height: number) => ipcRenderer.invoke('window:set-widget-height', height),
  selectCustomSound: () => ipcRenderer.invoke('app:select-custom-sound'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  openQuickAdd: (category?: string) => ipcRenderer.invoke('window:open-quick-add', category),
  closeQuickAdd: () => ipcRenderer.invoke('window:close-quick-add'),
  openPatchNotice: () => ipcRenderer.invoke('window:open-patch-notice'),
  closePatchNotice: () => ipcRenderer.invoke('window:close-patch-notice'),
  startUpdateDownload: (installerUrl?: string) => ipcRenderer.invoke('app:start-update-download', installerUrl),
  applyUpdateAndRestart: () => ipcRenderer.invoke('app:apply-update-and-restart'),
  openEditTask: (taskId: string) => ipcRenderer.invoke('window:open-edit-task', taskId),
  closeEditTask: () => ipcRenderer.invoke('window:close-edit-task'),
  setZenMode: (zenUntil: number | null) => ipcRenderer.invoke('app:set-zen-mode', zenUntil),
  snoozeTaskReminder: (taskId: string, minutes: number) => ipcRenderer.invoke('app:snooze-task', taskId, minutes),
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_: any, info: any) => callback(info);
    ipcRenderer.on('deck:update-available', handler);
    return () => {
      ipcRenderer.removeListener('deck:update-available', handler);
    };
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('deck:update-download-progress', handler);
    return () => {
      ipcRenderer.removeListener('deck:update-download-progress', handler);
    };
  },
  onUpdateDownloadComplete: (callback: (info: any) => void) => {
    const handler = (_: any, info: any) => callback(info);
    ipcRenderer.on('deck:update-download-complete', handler);
    return () => {
      ipcRenderer.removeListener('deck:update-download-complete', handler);
    };
  },
  onUpdateDownloadError: (callback: (errMsg: any) => void) => {
    const handler = (_: any, errMsg: any) => callback(errMsg);
    ipcRenderer.on('deck:update-download-error', handler);
    return () => {
      ipcRenderer.removeListener('deck:update-download-error', handler);
    };
  },
  onDataUpdated: (callback: (data: DeckData) => void) => {
    const handler = (_: any, data: DeckData) => callback(data);
    ipcRenderer.on('deck:data-updated', handler);
    return () => {
      ipcRenderer.removeListener('deck:data-updated', handler);
    };
  },
  onReminderSound: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('deck:play-reminder-sound', handler);
    return () => {
      ipcRenderer.removeListener('deck:play-reminder-sound', handler);
    };
  }
});
