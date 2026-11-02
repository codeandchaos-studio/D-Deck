import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Calendar, Clock, CheckSquare, Repeat, Volume2, VolumeX, ListChecks } from 'lucide-react';
import type { Task, TaskCategory, TaskPriority, ProtocolType, Subtask } from '../../types';
import { loadDeckData, saveDeckData } from '../../services/storage';
import { DDeckLogo } from '../common/DDeckLogo';
import { sfx } from '../../services/audio';

const DAYS_OF_WEEK = [
  { label: 'S', day: 0 },
  { label: 'M', day: 1 },
  { label: 'T', day: 2 },
  { label: 'W', day: 3 },
  { label: 'T', day: 4 },
  { label: 'F', day: 5 },
  { label: 'S', day: 6 },
];

export const QuickAddPopup: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState<string>('11:30');
  const [durationDays, setDurationDays] = useState<number>(1);
  const [isRoutine, setIsRoutine] = useState<boolean>(false);
  const [protocolType, setProtocolType] = useState<ProtocolType>('daily');
  const [protocolDays, setProtocolDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 80);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = () => {
    if (window.electronAPI?.closeQuickAdd) {
      window.electronAPI.closeQuickAdd();
    } else if (window.electronAPI) {
      window.electronAPI.closeWindow();
    } else {
      window.close();
    }
  };

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    setSubtasks([...subtasks, { id: 'st-' + Date.now(), title: subtaskInput.trim(), completed: false }]);
    setSubtaskInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    sfx.playClick();

    const newTask: Task = {
      id: 'task-' + Date.now(),
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate,
      dueTime: dueTime.trim() || undefined,
      durationDays,
      isRoutine,
      protocolType: isRoutine ? protocolType : undefined,
      protocolDays: isRoutine && protocolType === 'weekly' ? protocolDays : undefined,
      lastResetDate: isRoutine ? dueDate : undefined,
      reminderEnabled: true,
      soundEnabled,
      subtasks,
    };

    const currentData = await loadDeckData();
    const updatedData = {
      ...currentData,
      tasks: [newTask, ...currentData.tasks]
    };

    await saveDeckData(updatedData);
    handleClose();
  };

  return (
    <div className="w-full h-full flex flex-col glass-surface-panel rounded-2xl overflow-hidden font-sans select-none shadow-2xl border border-white/30">
      
      {/* Draggable Header */}
      <div className="titlebar-drag flex items-center justify-between px-4 py-3 bg-white/10 border-b border-white/20 cursor-move">
        <div className="flex items-center gap-2">
          <DDeckLogo size="sm" showText={false} />
          <span className="text-xs font-bold text-white tracking-wide">
            New Task
          </span>
        </div>

        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
            title="Cancel & Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between p-4 overflow-y-auto space-y-3">
        <div className="space-y-3">
          
          {/* Title */}
          <div>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 text-xs glass-input rounded-lg text-white placeholder-white/50 focus:outline-none transition-all font-medium"
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional notes or details..."
              className="w-full px-3 py-1.5 text-[11px] glass-input rounded-lg text-white placeholder-white/50 focus:outline-none resize-none transition-all font-normal"
            />
          </div>

          {/* Manual Category / Tag Field */}
          <div>
            <label className="block text-[11px] font-medium text-white/90 mb-1 tracking-wide">
              Category / Tag <span className="text-white/60 font-normal text-[10px]">(optional)</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Gaming, Coding, Project, Workout, Client..."
              className="w-full px-3 py-2 text-xs glass-input rounded-lg text-white placeholder-white/50 focus:outline-none transition-all"
            />
          </div>

          {/* Priority & Duration */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-white/80 mb-1 uppercase tracking-wider">
                Priority
              </label>
              <div className="flex gap-1">
                {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex-1 py-1 rounded-md text-[9px] uppercase transition-all border ${
                      priority === p
                        ? p === 'urgent'
                          ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 font-bold'
                          : p === 'high'
                          ? 'bg-amber-400/25 text-amber-300 border-amber-400/50 font-bold'
                          : p === 'medium'
                          ? 'bg-emerald-400/25 text-emerald-300 border-emerald-400/50 font-bold'
                          : 'bg-white text-zinc-950 border-white font-bold'
                        : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {p.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-white/80 mb-1 uppercase tracking-wider">
                Duration
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 7].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationDays(d)}
                    className={`flex-1 py-1 rounded-md text-[9px] font-mono border transition-all ${
                      durationDays === d
                        ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold'
                        : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Date & Time Schedule Box */}
          <div className="space-y-2 p-3 rounded-xl bg-white/10 border border-white/20">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-white/80 mb-1 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-white/80" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full glass-input rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-white/80 mb-1 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  Time (HH:mm)
                </label>
                <input
                  type="time"
                  value={dueTime}
                  onChange={e => setDueTime(e.target.value)}
                  className="w-full glass-input rounded-lg px-2.5 py-1 text-[11px] text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Time Presets */}
            <div className="flex items-center justify-between pt-1 text-[10px]">
              <span className="text-white/70">Quick time:</span>
              <div className="flex items-center gap-1 font-mono">
                {['11:30', '14:00', '18:30', '21:00'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDueTime(preset)}
                    className={`px-1.5 py-0.5 rounded-md border text-[9px] transition-all ${
                      dueTime === preset 
                        ? 'bg-amber-400/25 text-amber-300 border-amber-400/50 font-bold' 
                        : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
                {dueTime && (
                  <button
                    type="button"
                    onClick={() => setDueTime('')}
                    className="text-white/70 hover:text-rose-400 px-1 text-[10px]"
                    title="No specific time"
                  >
                    None
                  </button>
                )}
              </div>
            </div>

            {/* Protocol Auto-Reset Options */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Repeat className={`w-3.5 h-3.5 ${isRoutine ? 'text-emerald-400' : 'text-white/60'}`} />
                  <span className="text-[11px] text-white font-medium">Auto-Reset Protocol</span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRoutine}
                    onChange={e => setIsRoutine(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-400 rounded cursor-pointer"
                  />
                  <span className="text-[10px] text-white/70">Recurring Reset</span>
                </label>
              </div>

              {isRoutine && (
                <div className="p-2 rounded-lg bg-black/30 border border-white/10 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        setProtocolType('daily');
                      }}
                      className={`py-1 rounded font-semibold border transition-all ${
                        protocolType === 'daily'
                          ? 'bg-emerald-400/25 border-emerald-400 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Daily Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.playClick();
                        setProtocolType('weekly');
                      }}
                      className={`py-1 rounded font-semibold border transition-all ${
                        protocolType === 'weekly'
                          ? 'bg-amber-400/25 border-amber-400 text-amber-300'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Weekly Protocol
                    </button>
                  </div>

                  {protocolType === 'weekly' && (
                    <div className="grid grid-cols-7 gap-1 pt-1">
                      {DAYS_OF_WEEK.map(({ label, day }) => {
                        const active = protocolDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              sfx.playClick();
                              if (protocolDays.includes(day)) {
                                if (protocolDays.length > 1) {
                                  setProtocolDays(protocolDays.filter(d => d !== day));
                                }
                              } else {
                                setProtocolDays([...protocolDays, day].sort((a, b) => a - b));
                              }
                            }}
                            className={`py-1 rounded text-[10px] font-mono font-bold border transition-all ${
                              active
                                ? 'bg-amber-400 text-zinc-950 border-amber-300'
                                : 'bg-white/5 border-white/10 text-white/50'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Individual Task Chime Sound Toggle */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-white/40" />
                )}
                <span className="text-[11px] text-white font-medium">Reminder Sound</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={e => setSoundEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer"
                />
                <span className="text-[10px] text-white/70">{soundEnabled ? 'Chime ON' : 'Silent only'}</span>
              </label>
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1">
                <ListChecks className="w-3 h-3 text-amber-400" />
                Subtasks / Habit Items
              </label>
              {subtasks.length > 0 && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  {subtasks.length} item{subtasks.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={subtaskInput}
                onChange={e => setSubtaskInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="+ Add subtask (press Enter)..."
                className="flex-1 px-3 py-1.5 text-[11px] glass-input rounded-lg text-white placeholder-white/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {subtasks.length > 0 && (
              <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto pr-1 scrollbar-thin">
                {subtasks.map((s, idx) => (
                  <div key={s.id} className="text-[10px] text-white flex items-center justify-between bg-white/10 border border-white/20 px-2.5 py-1 rounded-lg">
                    <span className="flex items-center gap-1.5 truncate pr-2">
                      <span className="text-white/40 font-mono text-[9px]">{idx + 1}.</span>
                      {s.title}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setSubtasks(subtasks.filter(item => item.id !== s.id))}
                      className="text-white/60 hover:text-rose-400 text-xs px-1 font-mono"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/15 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || isSubmitting}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 disabled:opacity-40 transition-all active:scale-95 shadow-sm"
          >
            Add Task
          </button>
        </div>
      </form>
    </div>
  );
};
