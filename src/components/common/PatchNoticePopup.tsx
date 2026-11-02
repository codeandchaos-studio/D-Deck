import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Download, 
  X, 
  ExternalLink, 
  ArrowUpRight, 
  ShieldCheck, 
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import type { UpdateInfo, UpdateDownloadProgress } from '../../types';
import { checkUpdates, dismissUpdate } from '../../services/updater';
import { DDeckLogo } from './DDeckLogo';
import { sfx } from '../../services/audio';

export const PatchNoticePopup: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // In-App Auto Update State Machine
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState<UpdateDownloadProgress>({
    percent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0,
  });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    // Listen to update broadcast if available
    let unsubUpdate: (() => void) | undefined;
    if (window.electronAPI?.onUpdateAvailable) {
      unsubUpdate = window.electronAPI.onUpdateAvailable((info) => {
        if (isMounted && info) {
          setUpdateInfo(info);
          setIsLoading(false);
        }
      });
    }

    // Listen to in-app download progress
    let unsubProgress: (() => void) | undefined;
    if (window.electronAPI?.onUpdateDownloadProgress) {
      unsubProgress = window.electronAPI.onUpdateDownloadProgress((prog) => {
        if (isMounted && prog) {
          setDownloadState('downloading');
          setProgress(prog);
        }
      });
    }

    // Listen to in-app download complete
    let unsubComplete: (() => void) | undefined;
    if (window.electronAPI?.onUpdateDownloadComplete) {
      unsubComplete = window.electronAPI.onUpdateDownloadComplete(() => {
        if (isMounted) {
          setDownloadState('ready');
          sfx.playComplete();
        }
      });
    }

    // Listen to in-app download error
    let unsubError: (() => void) | undefined;
    if (window.electronAPI?.onUpdateDownloadError) {
      unsubError = window.electronAPI.onUpdateDownloadError((err) => {
        if (isMounted) {
          setDownloadState('error');
          setErrorMessage(err || 'Download failed');
        }
      });
    }

    async function fetchInfo() {
      try {
        const info = await checkUpdates(false);
        if (isMounted && info) {
          setUpdateInfo(info);
        }
      } catch (err) {
        console.warn('Failed to fetch update info in popup:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchInfo();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && downloadState !== 'downloading') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      if (unsubUpdate) unsubUpdate();
      if (unsubProgress) unsubProgress();
      if (unsubComplete) unsubComplete();
      if (unsubError) unsubError();
    };
  }, [downloadState]);

  const handleClose = () => {
    sfx.playClick();
    if (updateInfo) {
      dismissUpdate(updateInfo.latestVersion);
    }
    if (window.electronAPI?.closePatchNotice) {
      window.electronAPI.closePatchNotice();
    } else if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  const handleStartInAppUpdate = async () => {
    sfx.playClick();
    if (!updateInfo) return;

    if (window.electronAPI?.startUpdateDownload) {
      setDownloadState('downloading');
      setErrorMessage('');
      const targetUrl = updateInfo.installerUrl || updateInfo.downloadUrl;
      await window.electronAPI.startUpdateDownload(targetUrl);
    } else {
      // Browser fallback
      window.open(updateInfo.installerUrl || updateInfo.downloadUrl, '_blank');
      handleClose();
    }
  };

  const handleApplyRestart = () => {
    sfx.playClick();
    if (window.electronAPI?.applyUpdateAndRestart) {
      window.electronAPI.applyUpdateAndRestart();
    }
  };

  const handleOpenExternal = (url?: string) => {
    sfx.playClick();
    const targetUrl = url || updateInfo?.installerUrl || updateInfo?.downloadUrl || 'https://github.com/codeandchaos-studio/D-Deck/releases/latest';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(targetUrl);
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (speedBytes?: number) => {
    if (!speedBytes || speedBytes <= 0) return '';
    return (speedBytes / (1024 * 1024)).toFixed(1) + ' MB/s';
  };

  const formattedDate = updateInfo?.publishedAt
    ? new Date(updateInfo.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="w-full h-full flex flex-col glass-surface-panel rounded-2xl overflow-hidden font-sans select-none shadow-2xl border border-white/20 bg-[#0E0D13]/95 text-white">
      {/* Draggable Desktop Titlebar */}
      <div className="titlebar-drag flex items-center justify-between px-4 py-2.5 bg-white/10 border-b border-white/15 cursor-move">
        <div className="flex items-center gap-2">
          <DDeckLogo size="sm" showText={false} />
          <span className="text-xs font-bold text-white tracking-wide">
            D-Deck Update Center
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-semibold">
            v{updateInfo?.latestVersion || '2.2.0'}
          </span>
        </div>

        <div className="titlebar-no-drag flex items-center">
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 p-5 flex flex-col justify-between overflow-hidden relative">
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
            <span className="text-xs font-mono text-white/70">Connecting to release server...</span>
          </div>
        ) : (
          <>
            {/* Header / Version Details */}
            <div className="flex items-start justify-between pb-3 border-b border-white/15">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      New Patch Available: v{updateInfo?.latestVersion || '2.2.0'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-white/60 mt-0.5 font-mono">
                    Current: v{updateInfo?.currentVersion || '2.2.0'} • Released: {formattedDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono text-white/70">Verified Build</span>
              </div>
            </div>

            {/* Patch Notes / Changelog */}
            <div className="mt-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                  What's New in this Patch:
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenExternal(updateInfo?.downloadUrl)}
                  className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-mono transition-colors"
                >
                  <span>Release Notes</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex-1 overflow-y-auto scrollbar-thin text-xs text-white/85 leading-relaxed font-sans whitespace-pre-wrap select-text">
                {updateInfo?.releaseNotes || 'General performance optimizations, bug fixes, and system improvements.'}
              </div>
            </div>

            {/* Download Progress Card (Active when downloading or completed) */}
            {downloadState === 'downloading' && (
              <div className="mt-3 p-3 rounded-xl bg-white/5 border border-amber-400/30 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Downloading Update In-App...
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    {progress.percent}%
                  </span>
                </div>

                {/* Progress Track */}
                <div className="w-full h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-200 rounded-full"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-white/60">
                  <span>{formatBytes(progress.transferredBytes)} / {formatBytes(progress.totalBytes)}</span>
                  <span>{formatSpeed(progress.speedBytesPerSec)}</span>
                </div>
              </div>
            )}

            {downloadState === 'ready' && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-400/10 border border-emerald-400/40 space-y-1 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Update Downloaded &amp; Verified!</span>
                </div>
                <p className="text-[11px] text-white/70 pl-6">
                  Click below to restart D-Deck and apply all new features instantly.
                </p>
              </div>
            )}

            {downloadState === 'error' && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>In-App Download Error</span>
                </div>
                <p className="text-[10px] text-white/70">
                  {errorMessage || 'Unable to download directly. You can retry or download manually.'}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-between gap-3">
              {updateInfo?.portableUrl ? (
                <button
                  type="button"
                  onClick={() => handleOpenExternal(updateInfo.portableUrl)}
                  className="text-[11px] text-white/70 hover:text-white flex items-center gap-1 font-mono transition-colors"
                >
                  <span>Manual Portable (.exe)</span>
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                </button>
              ) : (
                <span className="text-[10px] text-white/40 font-mono">Code &amp; Chaos • We Built Stuff</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 border border-white/15 transition-all"
                >
                  {downloadState === 'ready' ? 'Install Later' : 'Later'}
                </button>

                {downloadState === 'ready' ? (
                  <button
                    type="button"
                    onClick={handleApplyRestart}
                    className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-zinc-950 flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-400/25 active:scale-95 animate-pulse"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart &amp; Install Now</span>
                  </button>
                ) : downloadState === 'downloading' ? (
                  <button
                    type="button"
                    disabled
                    className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-400/50 text-zinc-950 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Downloading ({progress.percent}%)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartInAppUpdate}
                    className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-400/20 active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Update Now</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
