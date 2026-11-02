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
import { sfx } from '../../services/audio';

interface PatchNoticeModalProps {
  isOpen: boolean;
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export const PatchNoticeModal: React.FC<PatchNoticeModalProps> = ({
  isOpen,
  updateInfo,
  onClose,
}) => {
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

    return () => {
      isMounted = false;
      if (unsubProgress) unsubProgress();
      if (unsubComplete) unsubComplete();
      if (unsubError) unsubError();
    };
  }, []);

  if (!isOpen || !updateInfo) return null;

  const handleStartInAppUpdate = async () => {
    sfx.playClick();
    if (window.electronAPI?.startUpdateDownload) {
      setDownloadState('downloading');
      setErrorMessage('');
      const targetUrl = updateInfo.installerUrl || updateInfo.downloadUrl;
      await window.electronAPI.startUpdateDownload(targetUrl);
    } else {
      window.open(updateInfo.installerUrl || updateInfo.downloadUrl, '_blank');
      onClose();
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
    const targetUrl = url || updateInfo.installerUrl || updateInfo.downloadUrl;
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

  const formattedDate = updateInfo.publishedAt 
    ? new Date(updateInfo.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-md select-none font-sans"
      onClick={downloadState !== 'downloading' ? onClose : undefined}
    >
      <div 
        className="w-full max-w-lg glass-surface-panel border border-white/25 rounded-2xl shadow-2xl p-5 relative overflow-hidden bg-[#0E0D13]/95 text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  New Patch Available: v{updateInfo.latestVersion}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                  Official Release
                </span>
              </div>
              <p className="text-[11px] text-white/60 mt-0.5 font-mono">
                Current: v{updateInfo.currentVersion} • Released: {formattedDate}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Patch Notes / Changelog */}
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">
              What's New in this Patch:
            </span>
            <button
              onClick={() => handleOpenExternal(updateInfo.downloadUrl)}
              className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-mono transition-colors"
            >
              <span>Release Notes</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 max-h-52 overflow-y-auto scrollbar-thin text-xs text-white/85 leading-relaxed font-sans whitespace-pre-wrap select-text">
            {updateInfo.releaseNotes || 'General performance optimizations, bug fixes, and system improvements.'}
          </div>
        </div>

        {/* In-App Download Progress Tracker */}
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
              <span>Update Ready to Apply!</span>
            </div>
            <p className="text-[11px] text-white/70 pl-6">
              Click below to restart D-Deck and apply all new features immediately.
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
        <div className="mt-4 pt-3 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {updateInfo.portableUrl ? (
            <button
              onClick={() => handleOpenExternal(updateInfo.portableUrl)}
              className="text-[11px] text-white/70 hover:text-white flex items-center gap-1 font-mono transition-colors order-2 sm:order-1"
            >
              <span>Download Portable (.exe)</span>
              <ArrowUpRight className="w-3 h-3 text-amber-400" />
            </button>
          ) : <div className="order-2 sm:order-1" />}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 border border-white/15 transition-all"
            >
              {downloadState === 'ready' ? 'Install Later' : 'Later'}
            </button>

            {downloadState === 'ready' ? (
              <button
                type="button"
                onClick={handleApplyRestart}
                className="flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold bg-emerald-400 hover:bg-emerald-300 text-zinc-950 flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-400/25 active:scale-95 animate-pulse"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restart &amp; Install Now</span>
              </button>
            ) : downloadState === 'downloading' ? (
              <button
                type="button"
                disabled
                className="flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold bg-amber-400/50 text-zinc-950 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading ({progress.percent}%)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartInAppUpdate}
                className="flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-400/20 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Update Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
