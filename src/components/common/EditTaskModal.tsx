import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Calendar, Clock, Repeat, Volume2, VolumeX, ListChecks, Trash2, Check, Tag, AlertTriangle } from 'lucide-react';
import type { Task, TaskPriority, Subtask } from '../../types';
import { sfx } from '../../services/audio';

interface EditTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onSaveTask: (updatedTask: Task) => void;
}

const CATEGORIES = ['coding', 'design', 'work', 'learning', 'routine', 'life', 'gaming'];

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  task,
  onClose,
  onSaveTask,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<string>('');
  const [dueTime, setDueTime] = useState<string>('11:30');
  const [durationDays, setDurationDays] = useState<number>(1);
  const [isRoutine, setIsRoutine] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setCategory(task.category || '');
      setPriority(task.priority || 'medium');
      setDueDate(task.dueDate || new Date().toISOString().split('T')[0]);
      setDueTime(task.dueTime || '11:30');
      setDurationDays(task.durationDays || 1);
      setIsRoutine(task.isRoutine || false);
      setSoundEnabled(task.soundEnabled !== false);
      setSubtasks(task.subtasks ? [...task.subtasks] : []);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, task]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const handleAddSubtask = () => {
    if (!subtaskInput.trim()) return;
    sfx.playClick();
    setSubtasks([
      ...subtasks,
      { id: 'st-' + Date.now(), title: subtaskInput.trim(), completed: false },
    ]);
    setSubtaskInput('');
  };

  const handleToggleSubtask = (subId: string) => {
    sfx.playClick();
    setSubtasks(
      subtasks.map(s => (s.id === subId ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleDeleteSubtask = (subId: string) => {
    sfx.playClick();
    setSubtasks(subtasks.filter(s => s.id !== subId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

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
      soundEnabled,
      subtasks,
    };

    onSaveTask(updatedTask);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-md overflow-y-auto font-sans select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92vh] glass-surface-panel border border-white/30 rounded-2xl shadow-2xl p-4 overflow-y-auto relative scrollbar-thin text-white"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/15">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-white tracking-wide">
              Edit Task
            </h3>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/10 text-white/60 border border-white/15">
              ID: {task.id.slice(-6)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
              Task Title
            </label>
            <input
              ref={inputRef}
              type="text"
              placeholder="What needs to be done?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white/10 hover:bg-white/15 focus:bg-black/50 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              placeholder="Detailed notes, steps, or URLs..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 focus:bg-black/50 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-1.5">
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
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Category / Tags */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1">
              Category / Tag
            </label>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    sfx.playClick();
                    setCategory(category === cat ? '' : cat);
                  }}
                  className={`px-2 py-0.5 text-[10px] rounded-md font-mono border transition-all ${
                    category === cat
                      ? 'bg-amber-400 text-zinc-950 border-amber-300 font-semibold'
                      : 'bg-white/5 border-white/15 text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Or type custom tag..."
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-2.5 py-1 text-xs bg-white/10 hover:bg-white/15 focus:bg-black/50 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none transition-all font-mono"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" /> Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white/10 border border-white/20 focus:border-amber-400 rounded-lg text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/70 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> Due Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-white/10 border border-white/20 focus:border-amber-400 rounded-lg text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Protocol & Reminder Toggles */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                sfx.playClick();
                setIsRoutine(!isRoutine);
              }}
              className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                isRoutine
                  ? 'bg-emerald-400/20 border-emerald-400/50 text-emerald-300'
                  : 'bg-white/5 border-white/15 text-white/60 hover:text-white'
              }`}
            >
              <Repeat className={`w-3.5 h-3.5 ${isRoutine ? 'text-emerald-400' : 'text-white/40'}`} />
              <div className="leading-tight">
                <div className="text-[11px] font-bold">Daily Protocol</div>
                <div className="text-[9px] text-white/50">Resets at midnight</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                sfx.playClick();
                setSoundEnabled(!soundEnabled);
              }}
              className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                soundEnabled
                  ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                  : 'bg-white/5 border-white/15 text-white/60 hover:text-white'
              }`}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-white/40" />
              )}
              <div className="leading-tight">
                <div className="text-[11px] font-bold">Audio Chime</div>
                <div className="text-[9px] text-white/50">{soundEnabled ? 'Enabled' : 'Muted'}</div>
              </div>
            </button>
          </div>

          {/* Subtasks Section */}
          <div className="pt-2 border-t border-white/15">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/70 flex items-center gap-1">
                <ListChecks className="w-3 h-3 text-amber-400" />
                Subtasks ({subtasks.filter(s => s.completed).length}/{subtasks.length})
              </label>
            </div>

            {/* Subtask Input */}
            <div className="flex items-center gap-1.5 mb-2">
              <input
                type="text"
                placeholder="Add a new subtask..."
                value={subtaskInput}
                onChange={e => setSubtaskInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 px-2.5 py-1 text-xs bg-white/10 hover:bg-white/15 focus:bg-black/50 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                disabled={!subtaskInput.trim()}
                className="p-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 rounded-lg transition-all"
                title="Add Subtask"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Subtasks List */}
            {subtasks.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                {subtasks.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between p-1.5 rounded-lg bg-white/5 border border-white/10 text-xs hover:bg-white/10 transition-all group"
                  >
                    <div
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleToggleSubtask(sub.id)}
                    >
                      <div
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                          sub.completed
                            ? 'bg-emerald-400 border-emerald-400 text-zinc-950'
                            : 'border-white/40 bg-white/10'
                        }`}
                      >
                        {sub.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                      <span
                        className={`text-[11px] truncate ${
                          sub.completed ? 'line-through text-white/40' : 'text-white/90'
                        }`}
                      >
                        <span className="text-white/40 font-mono text-[10px] mr-1.5">{idx + 1}.</span>
                        {sub.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="p-1 text-white/40 hover:text-rose-400 rounded transition-colors"
                      title="Remove subtask"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/15">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 border border-white/15 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-all shadow-md shadow-amber-400/20 active:scale-95"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
