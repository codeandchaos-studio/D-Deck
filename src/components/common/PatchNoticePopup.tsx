import React, { useState, useEffect } from 'react';
import { Sparkles, Download, X, ExternalLink, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';
import type { UpdateInfo } from '../../types';
import { checkUpdates, dismissUpdate } from '../../services/updater';
import { DDeckLogo } from './DDeckLogo';
import { sfx } from '../../services/audio';

export const PatchNoticePopup: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Listen to update broadcast if available
    let unsub: (() => void) | undefined;
    if (window.electronAPI?.onUpdateAvailable) {
      unsub = window.electronAPI.onUpdateAvailable((info) => {
        if (isMounted && info) {
          setUpdateInfo(info);
          setIsLoading(false);
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
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      if (unsub) unsub();
    };
  }, []);

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

  const handleOpenDownload = (url?: string) => {
    sfx.playClick();
    const targetUrl = url || updateInfo?.installerUrl || updateInfo?.downloadUrl || 'https://github.com/codeandchaos-studio/D-Deck/releases/latest';
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(targetUrl);
    } else {
      window.open(targetUrl, '_blank');
    }
    handleClose();
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
            D-Deck Update Notice
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-semibold">
            Official Release
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
            <span className="text-xs font-mono text-white/70">Checking release notes...</span>
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
                      New Patch Available: v{updateInfo?.latestVersion || '2.0.0'}
                    </h3>
                  </div>
                  <p className="text-[11px] text-white/60 mt-0.5 font-mono">
                    Current: v{updateInfo?.currentVersion || '2.0.0'} • Released: {formattedDate}
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
                  onClick={() => handleOpenDownload(updateInfo?.downloadUrl)}
                  className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-mono transition-colors"
                >
                  <span>GitHub Release</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex-1 overflow-y-auto scrollbar-thin text-xs text-white/85 leading-relaxed font-sans whitespace-pre-wrap select-text">
                {updateInfo?.releaseNotes || 'General performance optimizations, bug fixes, and system improvements.'}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between gap-3">
              {updateInfo?.portableUrl ? (
                <button
                  type="button"
                  onClick={() => handleOpenDownload(updateInfo.portableUrl)}
                  className="text-[11px] text-white/70 hover:text-white flex items-center gap-1 font-mono transition-colors"
                >
                  <span>Download Portable (.exe)</span>
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
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenDownload(updateInfo?.installerUrl || updateInfo?.downloadUrl)}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-400/20 active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Update Now</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
