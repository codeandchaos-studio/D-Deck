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
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_: any, info: any) => callback(info);
    ipcRenderer.on('deck:update-available', handler);
    return () => {
      ipcRenderer.removeListener('deck:update-available', handler);
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
