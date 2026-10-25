import React, { useState } from 'react';
import type { Task, AppSettings, StreakMetrics, UpdateInfo } from '../../types';
import { DDeckLogo } from '../common/DDeckLogo';
import { TaskItem } from '../widget/TaskItem';
import { QuickAddModal } from '../widget/QuickAddModal';
import { PatchNoticeModal } from '../common/PatchNoticeModal';
import logoImg from '../../assets/logo.png';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Settings as SettingsIcon, 
  Info,
  Minimize2, 
  Plus, 
  Search, 
  Download, 
  Bell, 
  Volume2, 
  Power,
  Minus,
  X,
  Globe,
  ExternalLink,
  Sparkles,
  Repeat,
  Flame,
  Music,
  Play,
  FolderOpen,
  RotateCcw,
  Tag,
  Check,
  CheckCircle2
} from 'lucide-react';
import { sfx } from '../../services/audio';
import { exportDataAsJSON } from '../../services/storage';
import { checkUpdates } from '../../services/updater';

interface DeckViewProps {
  tasks: Task[];
  settings: AppSettings;
  streak?: StreakMetrics;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onSwitchToWidget: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export const DeckView: React.FC<DeckViewProps> = ({
  tasks,
  settings,
  streak,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onToggleSubtask,
  onUpdateSettings,
  onSwitchToWidget,
  onMinimize,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available'>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isPatchModalOpen, setIsPatchModalOpen] = useState(false);

  const handleManualCheckUpdate = async () => {
    setUpdateStatus('checking');
    sfx.playClick();
    try {
      const info = await checkUpdates(true);
      setUpdateInfo(info);
      if (info.available) {
        setUpdateStatus('available');
        setIsPatchModalOpen(true);
      } else {
        setUpdateStatus('latest');
      }
    } catch {
      setUpdateStatus('latest');
    }
  };

  const handleOpenAdd = (defaultTag?: string) => {
    sfx.playClick();
    if (window.electronAPI?.openQuickAdd) {
      window.electronAPI.openQuickAdd(defaultTag || selectedTag || '');
    } else {
      setIsQuickAddOpen(true);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const totalTasks = tasks.length;
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const pendingTasksCount = tasks.filter(t => !t.completed).length;
  const urgentTasksCount = tasks.filter(t => !t.completed && t.priority === 'urgent').length;
  const overdueTasksCount = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;
  const todayTasksCount = tasks.filter(t => !t.completed && t.dueDate === todayStr).length;
  const routineTasksCount = tasks.filter(t => t.isRoutine).length;

  // Extract all distinct user-defined categories / tags dynamically
  const availableTags = Array.from(
    new Set(tasks.map(t => t.category?.trim()).filter((c): c is string => Boolean(c && c.length > 0)))
  );

  const filteredTasks = tasks.filter(t => {
    // Specific tab filtering
    if (activeTab === 'routines' && !t.isRoutine) return false;

    // Status filter
    if (statusFilter === 'pending' && t.completed) return false;
    if (statusFilter === 'completed' && !t.completed) return false;

    // Tag filter
    if (selectedTag && t.category?.toLowerCase() !== selectedTag.toLowerCase()) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q) ?? false;
      const matchCat = t.category?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }

    return true;
  });

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, count: pendingTasksCount },
    { id: 'tasks', label: 'All Tasks', icon: CheckSquare, count: totalTasks },
    { id: 'routines', label: 'Daily Protocols', icon: Repeat, count: routineTasksCount },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
    { id: 'about', label: 'About D-Deck', icon: Info },
  ];

  return (
    <div className="w-full h-full flex glass-surface rounded-2xl overflow-hidden font-sans select-none shadow-2xl border border-white/25">
      
      {/* Sidebar */}
      <div className="w-60 glass-surface-panel border-r border-white/20 flex flex-col justify-between p-4">
        <div>
          <div className="titlebar-drag pb-4 mb-4 border-b border-white/20 cursor-move flex items-center justify-start pl-1">
            <DDeckLogo size="md" variant="full" />
          </div>

          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    sfx.playClick();
                    setActiveTab(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                    isActive
                      ? 'bg-white/20 text-amber-300 font-bold border border-amber-400/50 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/15 text-white border border-white/20 font-semibold">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Dynamic User Tags in Sidebar */}
          {availableTags.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/15">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-white/80" />
                  Your Tags
                </span>
                {selectedTag && (
                  <button
                    onClick={() => setSelectedTag(null)}
                    className="text-[10px] text-amber-300 hover:underline transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 px-0.5 max-h-36 overflow-y-auto">
                {availableTags.map(tag => {
                  const isSelected = selectedTag?.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      onClick={() => {
                        sfx.playClick();
                        setSelectedTag(isSelected ? null : tag);
                        if (activeTab === 'settings' || activeTab === 'about') {
                          setActiveTab('tasks');
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] transition-all border ${
                        isSelected
                          ? 'bg-amber-400/30 text-amber-300 border-amber-400/60 font-bold'
                          : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-white/15 space-y-2">
          <button
            onClick={() => {
              sfx.playClick();
              onSwitchToWidget();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-mono font-medium transition-all active:scale-95"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Widget Mode
          </button>
          
          <div className="flex items-center justify-between text-[10px] text-white/70 font-mono px-1">
            <span>D-Deck v1.0.0</span>
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Offline
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
        
        {/* Top Header */}
        <div className="titlebar-drag px-6 py-3.5 border-b border-white/20 flex items-center justify-between bg-white/10 cursor-move">
          
          <div className="titlebar-no-drag flex items-center gap-2 glass-input rounded-xl px-3 py-1.5 w-72">
            <Search className="w-3.5 h-3.5 text-white/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks, notes, tags..."
              className="bg-transparent text-xs text-white placeholder-white/50 focus:outline-none w-full"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-white/70 hover:text-white text-xs font-mono">
                ×
              </button>
            )}
          </div>

          <div className="titlebar-no-drag flex items-center gap-2">
            <button
              onClick={() => handleOpenAdd()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs transition-all active:scale-95 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </button>

            <div className="h-4 w-px bg-white/20 mx-1" />

            <button
              onClick={onMinimize}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-all"
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-rose-400 hover:bg-rose-500/20 transition-all"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              
              {/* Bento Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl glass-card border border-white/20">
                  <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">Pending</span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">{pendingTasksCount}</div>
                  <div className="text-[11px] text-white/70 mt-1">{completedTasksCount} completed</div>
                </div>

                <div className="p-4 rounded-2xl glass-card border border-white/20">
                  <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Urgent</span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">{urgentTasksCount}</div>
                  <div className="text-[11px] text-white/70 mt-1">{overdueTasksCount} overdue</div>
                </div>

                <div className="p-4 rounded-2xl glass-card border border-white/20">
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Scheduled Today</span>
                  <div className="text-2xl font-bold font-mono text-amber-300 mt-1">
                    {todayTasksCount} <span className="text-xs text-white/70 font-normal">tasks</span>
                  </div>
                  <div className="text-[11px] text-white/70 mt-1">Active for today</div>
                </div>

                <div className="p-4 rounded-2xl glass-card border border-white/20">
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Completion Rate</span>
                  <div className="text-2xl font-bold font-mono text-emerald-300 mt-1">
                    {totalTasks > 0 ? Math.round((completedTasksCount / totalTasks) * 100) : 0}%
                  </div>
                  <div className="text-[11px] text-white/70 mt-1">{totalTasks} total logged</div>
                </div>
              </div>

              {/* Local Velocity & Consistency Streak Engine */}
              <div className="p-4 rounded-2xl glass-card border border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-400">
                    <Flame className="w-5 h-5 fill-amber-400/20" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">
                        Consistency & Velocity Engine
                      </h4>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 font-semibold">
                        100% Offline • Private
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      Private streak monitor tracking consecutive active days and 7-day completion cadence.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 font-mono text-right">
                  <div>
                    <span className="text-[9px] text-white/70 uppercase">Current Streak</span>
                    <div className="text-lg font-bold text-amber-300">
                      {streak?.currentStreak ?? 0} <span className="text-[10px] font-normal text-white/70">days</span>
                    </div>
                  </div>
                  <div className="h-7 w-px bg-white/15" />
                  <div>
                    <span className="text-[9px] text-white/70 uppercase">Best Record</span>
                    <div className="text-lg font-bold text-white">
                      {streak?.bestStreak ?? 0} <span className="text-[10px] font-normal text-white/70">days</span>
                    </div>
                  </div>
                  <div className="h-7 w-px bg-white/15" />
                  <div>
                    <span className="text-[9px] text-white/70 uppercase">7-Day Velocity</span>
                    <div className="text-lg font-bold text-emerald-300">
                      {streak?.weeklyVelocity ?? 0} <span className="text-[10px] font-normal text-white/70">done/wk</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasks List in Overview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Active Tasks ({tasks.filter(t => !t.completed).length})
                  </h3>
                  {selectedTag && (
                    <span className="text-xs text-amber-300 font-mono font-semibold">
                      Filtered by #{selectedTag}
                    </span>
                  )}
                </div>

                {tasks.filter(t => !t.completed).length === 0 ? (
                  <div className="p-8 text-center text-white/70 glass-card rounded-2xl border border-white/20">
                    No pending tasks! All clear or click <span className="text-amber-300 font-bold cursor-pointer hover:underline" onClick={() => handleOpenAdd()}>Add Task</span> to schedule one.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {tasks.filter(t => !t.completed).map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={onToggleTask}
                        onDelete={onDeleteTask}
                        onToggleSubtask={onToggleSubtask}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All Tasks Tab & Daily Routines Tab */}
          {(activeTab === 'tasks' || activeTab === 'routines') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">
                    {activeTab === 'routines' ? 'Daily Routines' : 'All Tasks'}
                  </h2>
                  <p className="text-xs text-white/70 mt-0.5">
                    {activeTab === 'routines' 
                      ? 'Everyday habits that automatically reset unchecked at midnight.' 
                      : 'Comprehensive task backlog with tag organization.'}
                  </p>
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl glass-card border border-white/20 text-xs">
                  {(['all', 'pending', 'completed'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => {
                        sfx.playClick();
                        setStatusFilter(f);
                      }}
                      className={`px-3 py-1 rounded-lg capitalize transition-all font-semibold ${
                        statusFilter === f
                          ? 'bg-amber-400 text-zinc-950 shadow-sm'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Items */}
              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <div className="p-10 text-center text-white/70 glass-card rounded-2xl border border-white/20">
                    No tasks matching your current view or filter.
                  </div>
                ) : (
                  filteredTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={onToggleTask}
                      onDelete={onDeleteTask}
                      onToggleSubtask={onToggleSubtask}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-6 max-w-2xl">
              <div className="p-6 rounded-2xl glass-surface-panel border border-white/25 space-y-4 shadow-xl">
                <div className="flex items-center gap-5">
                  <img 
                    src={logoImg} 
                    alt="D-Deck" 
                    className="h-20 w-auto object-contain drop-shadow-xl" 
                  />
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-white">D-Deck</h2>
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-400/25 text-amber-300 border border-amber-400/40">
                        v1.0.0 Stable
                      </span>
                    </div>
                    <p className="text-xs text-white/70 mt-1 font-mono">
                      Personal Command HUD & Stealth Desktop Widget for Windows
                    </p>
                    <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 text-xs font-mono font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Team Code & Chaos • We Built Stuff</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-white/90 leading-relaxed pt-3 border-t border-white/15">
                  D-Deck is an uncompromising, distraction-free desktop command center built specifically for developers, gamers, and focused professionals. Engineered without cloud dependencies, telemetries, or subscriptions, it gives you full ownership over your daily productivity with 100% offline local persistence.
                </p>

                {/* Release Specs */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl glass-card border border-white/20 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-white/70 font-mono uppercase tracking-wider">Version History</span>
                      <p className="text-white mt-1 font-semibold flex items-center gap-1.5">
                        <span>v2.0.0 Stable</span>
                        {updateStatus === 'available' && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-400 text-zinc-950 font-bold text-[9px] uppercase tracking-wider">
                            Update
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={updateStatus === 'checking'}
                      onClick={handleManualCheckUpdate}
                      className="mt-2 text-[10px] font-mono text-amber-300 hover:text-amber-200 text-left flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className={`w-2.5 h-2.5 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                      <span>
                        {updateStatus === 'checking' ? 'Checking GitHub...' : 
                         updateStatus === 'available' ? 'Update available! View patch' : 
                         updateStatus === 'latest' ? 'Up to date' : 'Check for updates'}
                      </span>
                    </button>
                  </div>
                  <div className="p-3 rounded-xl glass-card border border-white/20">
                    <span className="text-[10px] text-white/70 font-mono uppercase tracking-wider">Supported Platforms</span>
                    <p className="text-white mt-1 font-semibold">Desktop (Windows Live • macOS Coming)</p>
                  </div>
                  <div className="p-3 rounded-xl glass-card border border-white/20">
                    <span className="text-[10px] text-white/70 font-mono uppercase tracking-wider">Architecture</span>
                    <p className="text-white mt-1 font-semibold">Electron 35 • React 19 • TypeScript</p>
                  </div>
                  <div className="p-3 rounded-xl glass-card border border-white/20">
                    <span className="text-[10px] text-white/70 font-mono uppercase tracking-wider">License</span>
                    <p className="text-white mt-1 font-semibold">MIT License (Free Forever)</p>
                  </div>
                </div>

                {/* Direct Action Links */}
                <div className="flex items-center gap-3 pt-3 border-t border-white/15 text-xs">
                  <button
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.openExternal('https://github.com/codeandchaos-studio/D-Deck');
                      } else {
                        window.open('https://github.com/codeandchaos-studio/D-Deck', '_blank');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-amber-400/50 hover:text-amber-300 transition-all active:scale-95 font-medium"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>GitHub Repository</span>
                  </button>

                  <button
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.openExternal('https://codeandchaos-studio.github.io/D-Deck/');
                      } else {
                        window.open('https://codeandchaos-studio.github.io/D-Deck/', '_blank');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-emerald-400/50 hover:text-emerald-300 transition-all active:scale-95 font-medium"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Official Website</span>
                  </button>

                  <button
                    onClick={() => {
                      if (window.electronAPI) {
                        window.electronAPI.openExternal('https://github.com/codeandchaos-studio/D-Deck/releases');
                      } else {
                        window.open('https://github.com/codeandchaos-studio/D-Deck/releases', '_blank');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold transition-all active:scale-95 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Releases</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-5 max-w-xl">
              <div>
                <h2 className="text-base font-bold text-white">Settings</h2>
                <p className="text-xs text-white/70 mt-0.5">Preferences and local data management.</p>
              </div>

              <div className="space-y-3 font-sans">
                <div className="p-3.5 rounded-xl glass-card border border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10 text-white">
                      <Power className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Start with Windows</h4>
                      <p className="text-[11px] text-white/70">Launch widget silently on desktop login.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.startupOnBoot}
                    onChange={e => onUpdateSettings({ startupOnBoot: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl glass-card border border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10 text-white">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Desktop Notification System</h4>
                      <p className="text-[11px] text-white/70">Persistent alerts: 1 min before, at scheduled time, and every minute until marked complete.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notificationsEnabled}
                    onChange={e => onUpdateSettings({ notificationsEnabled: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl glass-card border border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10 text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Global Stealth Hotkey</h4>
                      <p className="text-[11px] text-white/70">Toggle HUD widget anywhere over games and code editors.</p>
                    </div>
                  </div>
                  <kbd className="px-2.5 py-1 rounded-md bg-white/15 border border-white/25 text-amber-300 font-mono text-[11px] font-bold">
                    Ctrl + Shift + D
                  </kbd>
                </div>

                <div className="p-3.5 rounded-xl glass-card border border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10 text-white">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Audio Feedback</h4>
                      <p className="text-[11px] text-white/70">Chime for notifications, sprint completion, and click tactile feel.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={e => onUpdateSettings({ soundEnabled: e.target.checked })}
                    className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                </div>

                {/* Custom Audio Chime File Selector */}
                <div className="p-3.5 rounded-xl glass-card border border-white/20 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/10 text-amber-400">
                        <Music className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Notification Chime Audio</h4>
                        <p className="text-[11px] text-white/70">
                          {settings.customSoundPath 
                            ? `Custom File: ${settings.customSoundPath.split(/[/\\]/).pop()}` 
                            : 'Default: Synthetic Dual-Tone Chime (0 KB footprint)'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => sfx.playReminderChime(settings.customSoundPath)}
                        className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all flex items-center gap-1"
                        title="Test Current Chime"
                      >
                        <Play className="w-3 h-3 text-emerald-400" />
                        Test
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.electronAPI?.selectCustomSound) {
                            const path = await window.electronAPI.selectCustomSound();
                            if (path) {
                              onUpdateSettings({ customSoundPath: path });
                              sfx.setCustomSoundPath(path);
                              sfx.playReminderChime(path);
                            }
                          }
                        }}
                        className="px-3 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                      >
                        <FolderOpen className="w-3 h-3" />
                        Choose Audio File...
                      </button>
                      {settings.customSoundPath && (
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ customSoundPath: undefined });
                            sfx.setCustomSoundPath(null);
                            sfx.playSyntheticChime();
                          }}
                          className="px-2 py-1 rounded-md bg-white/10 hover:bg-rose-500/20 text-rose-300 text-xs font-mono border border-white/15 hover:border-rose-500/40 transition-all flex items-center gap-1"
                          title="Reset to default sound"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-white/50 pl-11 font-mono">
                    Audio is loaded directly from your computer storage. No files uploaded or bundled into the app, keeping your system fast and 100% private.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl glass-card border border-white/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/10 text-white">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Export Local Data</h4>
                      <p className="text-[11px] text-white/70">Export tasks, schedules, and metrics to standard JSON backup.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => exportDataAsJSON({ tasks, settings })}
                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-amber-400/50 hover:text-amber-300 text-xs font-mono font-medium transition-all"
                  >
                    Export JSON
                  </button>
                </div>

                {/* Application Updates Card */}
                <div className="p-3.5 rounded-xl glass-card border border-white/20 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/10 text-amber-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white">Application Updates</h4>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white/80 border border-white/15">
                            v2.0.0
                          </span>
                        </div>
                        <p className="text-[11px] text-white/70">
                          {updateStatus === 'checking' && 'Checking GitHub releases for latest patches...'}
                          {updateStatus === 'latest' && 'You are running the latest official version.'}
                          {updateStatus === 'available' && updateInfo && `New patch available: v${updateInfo.latestVersion}`}
                          {updateStatus === 'idle' && 'Check for official patches, features, and fixes.'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {updateStatus === 'available' && updateInfo && (
                        <button
                          type="button"
                          onClick={() => setIsPatchModalOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-zinc-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 animate-pulse"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>View Patch ({updateInfo.latestVersion})</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={updateStatus === 'checking'}
                        onClick={handleManualCheckUpdate}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-amber-400/50 hover:text-amber-300 text-xs font-mono font-medium transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${updateStatus === 'checking' ? 'animate-spin text-amber-400' : ''}`} />
                        <span>{updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}</span>
                      </button>
                    </div>
                  </div>
                  {updateStatus === 'latest' && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono pl-11">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Up to date. No new releases pending.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAddTask={onAddTask}
        initialCategory={selectedTag || ''}
      />

      <PatchNoticeModal
        isOpen={isPatchModalOpen}
        updateInfo={updateInfo}
        onClose={() => setIsPatchModalOpen(false)}
      />
    </div>
  );
};
