import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Plus, 
  Calendar, 
  Clock, 
  Repeat, 
  Volume2, 
  VolumeX, 
  ListChecks, 
  Trash2, 
  Check, 
  Tag, 
  Sparkles,
  CalendarDays,
  CheckCircle2
} from 'lucide-react';
import type { Task, TaskPriority, Subtask, ProtocolType } from '../../types';
import { loadDeckData, saveDeckData } from '../../services/storage';
import { DDeckLogo } from './DDeckLogo';
import { sfx } from '../../services/audio';

const CATEGORIES = ['coding', 'design', 'work', 'learning', 'routine', 'life', 'gaming'];
const DAYS_OF_WEEK = [
  { label: 'S', name: 'Sun', day: 0 },
  { label: 'M', name: 'Mon', day: 1 },
  { label: 'T', name: 'Tue', day: 2 },
  { label: 'W', name: 'Wed', day: 3 },
  { label: 'T', name: 'Thu', day: 4 },
  { label: 'F', name: 'Fri', day: 5 },
  { label: 'S', name: 'Sat', day: 6 },
];

export const EditTaskPopup: React.FC = () => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('11:30');
  const [durationDays, setDurationDays] = useState<number>(1);
  const [isRoutine, setIsRoutine] = useState<boolean>(false);
  const [protocolType, setProtocolType] = useState<ProtocolType>('daily');
  const [protocolDays, setProtocolDays] = useState<number[]>([1, 2, 3, 4, 5]); // default weekdays
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Subtasks State
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDate, setNewSubtaskDate] = useState('');
  const [newSubtaskTime, setNewSubtaskTime] = useState('');
  const [showSubtaskSchedule, setShowSubtaskSchedule] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // Load target task on mount
  useEffect(() => {
    async function init() {
      const hash = window.location.hash;
      const qIdx = hash.indexOf('?');
      const params = new URLSearchParams(qIdx !== -1 ? hash.slice(qIdx) : '');
      const taskId = params.get('id');

      if (!taskId) {
        setLoading(false);
        return;
      }

      const deckData = await loadDeckData();
      const found = deckData.tasks.find(t => t.id === taskId);
      if (found) {
        setTask(found);
        setTitle(found.title || '');
        setDescription(found.description || '');
        setCategory(found.category || '');
        setPriority(found.priority || 'medium');
        setDueDate(found.dueDate || new Date().toISOString().split('T')[0]);
        setDueTime(found.dueTime || '11:30');
        setDurationDays(found.durationDays || 1);
        setIsRoutine(found.isRoutine || false);
        setProtocolType(found.protocolType || 'daily');
        setProtocolDays(found.protocolDays && found.protocolDays.length > 0 ? found.protocolDays : [1, 2, 3, 4, 5]);
        setSoundEnabled(found.soundEnabled !== false);
        setSubtasks(found.subtasks ? [...found.subtasks] : []);
      }
      setLoading(false);
      setTimeout(() => titleRef.current?.focus(), 80);
    }
    init();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    sfx.playClick();
    if (window.electronAPI?.closeEditTask) {
      window.electronAPI.closeEditTask();
    } else if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  const setQuickDate = (type: 'today' | 'tomorrow' | 'weekend' | 'clear') => {
    sfx.playClick();
    const now = new Date();
    if (type === 'today') {
      setDueDate(now.toISOString().split('T')[0]);
    } else if (type === 'tomorrow') {
      const tom = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setDueDate(tom.toISOString().split('T')[0]);
    } else if (type === 'weekend') {
      const diff = (6 - now.getDay() + 7) % 7 || 7;
      const sat = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      setDueDate(sat.toISOString().split('T')[0]);
    } else {
      setDueDate('');
      setDueTime('');
    }
  };

  const toggleProtocolDay = (day: number) => {
    sfx.playClick();
    if (protocolDays.includes(day)) {
      if (protocolDays.length > 1) {
        setProtocolDays(protocolDays.filter(d => d !== day));
      }
    } else {
      setProtocolDays([...protocolDays, day].sort((a, b) => a - b));
    }
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    sfx.playClick();
    const newSub: Subtask = {
      id: 'st-' + Date.now(),
      title: newSubtaskTitle.trim(),
      completed: false,
      dueDate: newSubtaskDate || undefined,
      dueTime: newSubtaskTime.trim() || undefined,
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskTitle('');
    setNewSubtaskDate('');
    setNewSubtaskTime('');
    setShowSubtaskSchedule(false);
  };

  const handleToggleSubtask = (subId: string) => {
    sfx.playClick();
    setSubtasks(subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s));
  };

  const handleDeleteSubtask = (subId: string) => {
    sfx.playClick();
    setSubtasks(subtasks.filter(s => s.id !== subId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !title.trim()) return;

    sfx.playClick();

    const updatedTask: Task = {
      ...task,
      title: title.trim(),
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime.trim() || undefined,
      durationDays,
      isRoutine,
      protocolType: isRoutine ? protocolType : undefined,
      protocolDays: isRoutine && protocolType === 'weekly' ? protocolDays : undefined,
      soundEnabled,
      subtasks,
    };

    const currentData = await loadDeckData();
    const updatedTasks = currentData.tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    await saveDeckData({ ...currentData, tasks: updatedTasks });
    handleClose();
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#0E0D13] text-white/70 font-mono text-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>Opening Task Editor...</span>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#0E0D13] text-white/70 p-6 text-center">
        <p className="text-xs mb-3">Task not found or was deleted.</p>
        <button
          onClick={handleClose}
          className="px-4 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-lg text-white"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col glass-surface-panel rounded-2xl overflow-hidden font-sans select-none shadow-2xl border border-white/25 bg-[#0E0D13]/95 text-white">
      {/* Draggable Desktop Titlebar */}
      <div className="titlebar-drag flex items-center justify-between px-4 py-2.5 bg-white/10 border-b border-white/15 cursor-move">
        <div className="flex items-center gap-2">
          <DDeckLogo size="sm" showText={false} />
          <span className="text-xs font-bold text-white tracking-wide">
            Edit Task
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white/60 border border-white/15">
            Desktop HUD Mode
          </span>
        </div>

        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 flex flex-col justify-between overflow-y-auto scrollbar-thin space-y-3.5">
        {/* Task Title */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
            Task Title
          </label>
          <input
            ref={titleRef}
            type="text"
            placeholder="What needs to be accomplished?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white/10 hover:bg-white/15 focus:bg-black/60 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none transition-all font-sans"
            required
          />
        </div>

        {/* Description / Notes */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
            Description &amp; Steps (Optional)
          </label>
          <textarea
            placeholder="Add detailed context, URLs, or notes..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 focus:bg-black/60 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none transition-all resize-none font-sans"
          />
        </div>

        {/* Priority & Category Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Priority */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-1">
              {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setPriority(p);
                  }}
                  className={`py-1 text-[10px] font-semibold uppercase rounded-lg border transition-all ${
                    priority === p
                      ? p === 'urgent'
                        ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                        : p === 'high'
                        ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold'
                        : p === 'medium'
                        ? 'bg-sky-500 text-white border-sky-400'
                        : 'bg-emerald-500 text-white border-emerald-400'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {p[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
              Tag / Category
            </label>
            <input
              type="text"
              placeholder="coding, work, life..."
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-white/10 hover:bg-white/15 focus:bg-black/60 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none transition-all font-mono"
            />
          </div>
        </div>

        {/* Date & Time with Zero-Click Presets */}
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/15 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-400" />
              Schedule &amp; Deadlines
            </span>
            <div className="flex items-center gap-1 text-[9px] font-mono">
              <button
                type="button"
                onClick={() => setQuickDate('today')}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-amber-400/20 hover:text-amber-300 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('tomorrow')}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-amber-400/20 hover:text-amber-300 transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setQuickDate('weekend')}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-amber-400/20 hover:text-amber-300 transition-colors"
              >
                Weekend
              </button>
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setQuickDate('clear')}
                  className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-rose-500/20 text-white/60 hover:text-rose-300 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-white/50 mb-0.5 font-mono">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-black/40 border border-white/20 focus:border-amber-400 rounded-lg text-white focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[9px] text-white/50 mb-0.5 font-mono">Due Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-black/40 border border-white/20 focus:border-amber-400 rounded-lg text-white focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Recurring Protocol Matrix (Daily vs Weekly) */}
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/15 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1">
              <Repeat className="w-3 h-3 text-emerald-400" />
              Auto-Reset Protocol
            </span>
            <span className="text-[9px] font-mono text-emerald-400 font-semibold">
              {isRoutine ? (protocolType === 'weekly' ? 'Weekly Active' : 'Daily Active') : 'Disabled'}
            </span>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => {
                sfx.playClick();
                setIsRoutine(false);
              }}
              className={`py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                !isRoutine 
                  ? 'bg-white/15 border-white/30 text-white shadow-sm' 
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              One-Time Task
            </button>
            <button
              type="button"
              onClick={() => {
                sfx.playClick();
                setIsRoutine(true);
                setProtocolType('daily');
              }}
              className={`py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                isRoutine && protocolType === 'daily'
                  ? 'bg-emerald-400/25 border-emerald-400 text-emerald-300 font-bold shadow-sm'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              Daily Protocol
            </button>
            <button
              type="button"
              onClick={() => {
                sfx.playClick();
                setIsRoutine(true);
                setProtocolType('weekly');
              }}
              className={`py-1 text-[10px] font-semibold rounded-lg border transition-all ${
                isRoutine && protocolType === 'weekly'
                  ? 'bg-amber-400/25 border-amber-400 text-amber-300 font-bold shadow-sm'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
              }`}
            >
              Weekly Protocol
            </button>
          </div>

          {/* Weekly Day Matrix */}
          {isRoutine && protocolType === 'weekly' && (
            <div className="pt-1.5 space-y-1.5">
              <div className="flex items-center justify-between text-[9px] text-white/60 font-mono">
                <span>Select active days of week:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setProtocolDays([1, 2, 3, 4, 5])}
                    className="hover:text-amber-300 transition-colors"
                  >
                    Weekdays
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setProtocolDays([0, 6])}
                    className="hover:text-amber-300 transition-colors"
                  >
                    Weekends
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setProtocolDays([0, 1, 2, 3, 4, 5, 6])}
                    className="hover:text-amber-300 transition-colors"
                  >
                    All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map(({ label, name, day }) => {
                  const active = protocolDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleProtocolDay(day)}
                      className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                        active
                          ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-sm scale-100'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                      title={name}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Subtasks Management with Date & Time */}
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/15 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1">
              <ListChecks className="w-3 h-3 text-amber-400" />
              Subtasks ({subtasks.filter(s => s.completed).length}/{subtasks.length})
            </span>
            <button
              type="button"
              onClick={() => setShowSubtaskSchedule(!showSubtaskSchedule)}
              className={`text-[9px] font-mono flex items-center gap-1 transition-colors ${
                showSubtaskSchedule ? 'text-amber-300' : 'text-white/50 hover:text-white'
              }`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{showSubtaskSchedule ? 'Hide subtask schedule' : '+ Schedule subtasks'}</span>
            </button>
          </div>

          {/* Add Subtask Row */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Add subtask title..."
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 px-2.5 py-1 text-xs bg-black/40 hover:bg-black/60 focus:bg-black/80 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="px-2.5 py-1 text-xs font-bold bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 rounded-lg flex items-center gap-1 transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-3 h-3" />
                <span>Add</span>
              </button>
            </div>

            {/* Optional Subtask Date & Time Fields */}
            {showSubtaskSchedule && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                <div>
                  <label className="block text-[9px] text-white/50 mb-0.5 font-mono">Subtask Date</label>
                  <input
                    type="date"
                    value={newSubtaskDate}
                    onChange={e => setNewSubtaskDate(e.target.value)}
                    className="w-full px-2 py-0.5 text-[11px] bg-black/50 border border-white/20 focus:border-amber-400 rounded-lg text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] text-white/50 mb-0.5 font-mono">Subtask Time</label>
                  <input
                    type="time"
                    value={newSubtaskTime}
                    onChange={e => setNewSubtaskTime(e.target.value)}
                    className="w-full px-2 py-0.5 text-[11px] bg-black/50 border border-white/20 focus:border-amber-400 rounded-lg text-white focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Subtasks List */}
          {subtasks.length > 0 && (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin pt-1">
              {subtasks.map((sub, idx) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-1.5 rounded-lg bg-black/30 border border-white/10 hover:border-amber-400/40 text-xs transition-all group"
                >
                  <div
                    className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleToggleSubtask(sub.id)}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                        sub.completed
                          ? 'bg-emerald-400 border-emerald-400 text-zinc-950 font-bold'
                          : 'border-white/40 bg-white/10'
                      }`}
                    >
                      {sub.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span
                      className={`text-[11px] truncate flex-1 ${
                        sub.completed ? 'line-through text-white/40' : 'text-white/90'
                      }`}
                    >
                      <span className="text-white/40 font-mono text-[10px] mr-1.5">{idx + 1}.</span>
                      {sub.title}
                    </span>

                    {/* Subtask Date/Time Micro-Badge */}
                    {(sub.dueDate || sub.dueTime) && (
                      <span className="inline-flex items-center gap-1 font-mono text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-amber-300 border border-white/15">
                        <Clock className="w-2.5 h-2.5 text-amber-400" />
                        {sub.dueTime || ''} {sub.dueDate ? `(${sub.dueDate.slice(5)})` : ''}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSubtask(sub.id)}
                    className="p-1 text-white/40 hover:text-rose-400 rounded opacity-0 group-hover:opacity-100 transition-all ml-2"
                    title="Remove subtask"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audio Chime Notification Toggle */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 text-xs">
          <div className="flex items-center gap-2">
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-white/40" />
            )}
            <div>
              <span className="font-semibold text-white">Audio Chime Alert</span>
              <p className="text-[10px] text-white/50">Play chime at scheduled reminder stages</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              sfx.playClick();
              setSoundEnabled(!soundEnabled);
            }}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-all ${
              soundEnabled
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                : 'bg-white/5 text-white/50 border-white/15'
            }`}
          >
            {soundEnabled ? 'ON' : 'MUTED'}
          </button>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-white/15 flex items-center justify-between">
          <span className="text-[10px] font-mono text-white/40">
            Esc to cancel • Enter to save
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 border border-white/15 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-all shadow-md shadow-amber-400/20 active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
