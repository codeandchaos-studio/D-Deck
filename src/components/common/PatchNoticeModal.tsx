import React from 'react';
import { Sparkles, Download, X, ExternalLink, ArrowUpRight } from 'lucide-react';
import type { UpdateInfo } from '../../types';

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
  if (!isOpen || !updateInfo) return null;

  const handleOpenDownload = (url?: string) => {
    const targetUrl = url || updateInfo.installerUrl || updateInfo.downloadUrl;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(targetUrl);
    } else {
      window.open(targetUrl, '_blank');
    }
  };

  const formattedDate = updateInfo.publishedAt 
    ? new Date(updateInfo.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-md select-none font-sans"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg glass-surface-panel border border-white/25 rounded-2xl shadow-2xl p-5 relative overflow-hidden"
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
              onClick={() => handleOpenDownload(updateInfo.downloadUrl)}
              className="text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 font-mono transition-colors"
            >
              <span>GitHub Release</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 max-h-56 overflow-y-auto scrollbar-thin text-xs text-white/85 leading-relaxed font-sans whitespace-pre-wrap">
            {updateInfo.releaseNotes || 'General performance optimizations, bug fixes, and system improvements.'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 pt-3 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {updateInfo.portableUrl ? (
            <button
              onClick={() => handleOpenDownload(updateInfo.portableUrl)}
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
              Later
            </button>
            <button
              type="button"
              onClick={() => handleOpenDownload(updateInfo.installerUrl || updateInfo.downloadUrl)}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-400/20 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Update Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
