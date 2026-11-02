import React, { useState } from 'react';
import { Check, Clock, Trash2, ChevronDown, ChevronUp, AlertCircle, Repeat, VolumeX, ListChecks, Pencil, Plus } from 'lucide-react';
import type { Task } from '../../types';
import { PriorityBadge } from '../common/PriorityBadge';
import { sfx } from '../../services/audio';

interface TaskItemProps {
  task: Task;
  isWidgetMode?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onEdit?: (task: Task) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string, dueTime?: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  isWidgetMode = false,
  onToggle,
  onDelete,
  onEdit,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inlineSubtaskTitle, setInlineSubtaskTitle] = useState('');
  const [inlineSubtaskTime, setInlineSubtaskTime] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue = !task.completed && task.dueDate && task.dueDate < todayStr;
  const isDueToday = !task.completed && task.dueDate === todayStr;

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    sfx.playClick();
    if (isWidgetMode && window.electronAPI?.openEditTask) {
      window.electronAPI.openEditTask(task.id);
    } else if (onEdit) {
      onEdit(task);
    }
  };

  const getProtocolLabel = () => {
    if (!task.isRoutine) return null;
    if (task.protocolType === 'weekly' && Array.isArray(task.protocolDays) && task.protocolDays.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const isWeekdays = task.protocolDays.length === 5 && [1, 2, 3, 4, 5].every(d => task.protocolDays!.includes(d));
      const isWeekends = task.protocolDays.length === 2 && [0, 6].every(d => task.protocolDays!.includes(d));
      const summary = isWeekdays ? 'Weekdays' : isWeekends ? 'Weekends' : task.protocolDays.map(d => dayNames[d]).join(', ');
      return `Weekly: ${summary}`;
    }
    return 'Daily Protocol';
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.completed) {
      sfx.playComplete();
    } else {
      sfx.playClick();
    }
    onToggle(task.id);
  };

  const getDueLabel = () => {
    if (!task.dueDate && !task.dueTime) return null;

    const timeBadge = task.dueTime ? (
      <span className="inline-flex items-center gap-1 font-mono text-[9px] text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/40 font-semibold">
        <Clock className="w-2.5 h-2.5 text-amber-400" />
        {task.dueTime}
      </span>
    ) : null;

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-rose-400 flex items-center gap-1 text-[9px] font-mono font-bold">
            <AlertCircle className="w-2.5 h-2.5" /> Overdue
          </span>
          {timeBadge}
        </span>
      );
    }

    if (isDueToday) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-emerald-300 font-mono text-[9px] font-bold">
            Today
          </span>
          {timeBadge}
        </span>
      );
    }

    if (task.dueDate) {
      const diffDays = Math.ceil((new Date(task.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-white/70 font-mono text-[9px]">{diffDays}d left</span>
          {timeBadge}
        </span>
      );
    }

    return timeBadge;
  };

  return (
    <div 
      className={`group relative rounded-xl border transition-all duration-150 overflow-hidden ${
        task.completed 
          ? 'bg-white/5 border-white/10 opacity-60' 
          : isOverdue
          ? 'bg-rose-500/10 border-rose-500/40'
          : 'glass-card border-white/20 hover:border-amber-400/50 hover:bg-white/15'
      }`}
    >
      <div className="p-2.5">
        <div className="flex items-start gap-2">
          {/* Minimalist Checkbox */}
          <button
            onClick={handleCheckboxClick}
            className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-md border flex items-center justify-center transition-all ${
              task.completed 
                ? 'bg-emerald-400 border-emerald-400 text-zinc-950 font-bold' 
                : 'border-white/40 hover:border-amber-400 bg-white/10'
            }`}
          >
            {task.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
          </button>

          {/* Task Info */}
          <div className="flex-1 min-w-0" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="flex items-center justify-between gap-2">
              <span 
                className={`text-xs font-medium leading-snug cursor-pointer transition-all ${
                  task.completed 
                    ? 'line-through text-white/50' 
                    : 'text-white hover:text-amber-200'
                }`}
              >
                {task.title}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <PriorityBadge priority={task.priority} showText={false} />
              </div>
            </div>

            {/* Badges / Meta row */}
            <div className="flex items-center gap-2 mt-1.5 text-[10px]">
              {task.category && task.category.trim() && (
                <span className="px-1.5 py-0.5 rounded font-mono border text-[9px] bg-white/10 text-white border-white/20">
                  {task.category.trim()}
                </span>
              )}

              {task.isRoutine && (
                <span 
                  className={`inline-flex items-center gap-1 font-mono text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                    task.protocolType === 'weekly' 
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' 
                      : 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40'
                  }`} 
                  title={getProtocolLabel() || 'Protocol'}
                >
                  <Repeat className="w-2.5 h-2.5" />
                  {getProtocolLabel()}
                </span>
              )}

              {task.reminderEnabled && task.soundEnabled === false && (
                <span className="inline-flex items-center gap-1 text-white/50 font-mono text-[9px] bg-white/5 px-1 py-0.5 rounded border border-white/10" title="Reminder is silent (chime muted)">
                  <VolumeX className="w-2.5 h-2.5" />
                  Silent
                </span>
              )}

              {getDueLabel()}

              {task.durationDays && task.durationDays > 1 && (
                <span className="text-white/60 font-mono">
                  {task.durationDays}d span
                </span>
              )}

              {task.subtasks && task.subtasks.length > 0 && (
                <span className="inline-flex items-center gap-1 text-white/80 font-mono text-[9px] bg-white/10 px-1.5 py-0.5 rounded border border-white/20">
                  <ListChecks className="w-2.5 h-2.5 text-amber-400" />
                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                </span>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleEditClick}
              className="p-1 text-white/60 hover:text-amber-300 rounded-md hover:bg-amber-400/20 opacity-0 group-hover:opacity-100 transition-all"
              title="Edit task"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="p-1 text-white/60 hover:text-rose-400 rounded-md hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-all"
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1 text-white/60 hover:text-white rounded-md transition-all"
              title={isExpanded ? "Collapse" : "Expand details & subtasks"}
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Expanded Drawer */}
        {isExpanded && (
          <div className="mt-2.5 pt-2 border-t border-white/10 pl-6 text-[11px] space-y-2">
            {task.description && (
              <p className="text-white/80 leading-relaxed font-sans">{task.description}</p>
            )}

            {/* Checklist progress and items */}
            {task.subtasks && task.subtasks.length > 0 && (() => {
              const completedCount = task.subtasks.filter(s => s.completed).length;
              const totalCount = task.subtasks.length;
              const percent = Math.round((completedCount / totalCount) * 100);

              return (
                <div className="space-y-2 mt-1.5">
                  <div className="flex items-center justify-between text-[10px] text-white/70 font-mono">
                    <span className="flex items-center gap-1 text-white/80">
                      <ListChecks className="w-3 h-3 text-amber-400" />
                      Checklist ({completedCount}/{totalCount})
                    </span>
                    <span className="text-emerald-400 font-bold">{percent}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-400 transition-all duration-300 rounded-full" 
                      style={{ width: `${percent}%` }} 
                    />
                  </div>
                  <div className="space-y-1.5 mt-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                    {task.subtasks.map((sub, idx) => (
                      <div 
                        key={sub.id} 
                        className={`flex items-center justify-between p-1.5 rounded-lg border transition-all group/sub ${
                          sub.completed 
                            ? 'bg-white/5 border-white/5 text-white/50' 
                            : 'bg-white/10 border-white/15 text-white hover:bg-white/15 hover:border-amber-400/40'
                        }`}
                      >
                        <div 
                          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                          onClick={() => onToggleSubtask && onToggleSubtask(task.id, sub.id)}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            sub.completed ? 'bg-emerald-400 border-emerald-400 text-zinc-950 font-bold' : 'border-white/40 bg-white/10'
                          }`}>
                            {sub.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className={`text-[11px] leading-snug select-none truncate ${sub.completed ? 'line-through' : ''}`}>
                            <span className="text-white/40 font-mono text-[10px] mr-1.5">{idx + 1}.</span>
                            {sub.title}
                          </span>

                          {(sub.dueDate || sub.dueTime) && (
                            <span className="inline-flex items-center gap-1 font-mono text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-amber-300 border border-white/15 shrink-0 ml-1">
                              <Clock className="w-2.5 h-2.5 text-amber-400" />
                              {sub.dueTime || ''} {sub.dueDate ? `(${sub.dueDate.slice(5)})` : ''}
                            </span>
                          )}
                        </div>

                        {onDeleteSubtask && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              sfx.playClick();
                              onDeleteSubtask(task.id, sub.id);
                            }}
                            className="p-1 text-white/40 hover:text-rose-400 rounded opacity-0 group-hover/sub:opacity-100 transition-all shrink-0 ml-1"
                            title="Delete subtask"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Quick Inline Subtask Add inside task drawer */}
            {onAddSubtask && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!inlineSubtaskTitle.trim()) return;
                  sfx.playClick();
                  onAddSubtask(task.id, inlineSubtaskTitle.trim(), inlineSubtaskTime.trim() || undefined);
                  setInlineSubtaskTitle('');
                  setInlineSubtaskTime('');
                  setShowTimePicker(false);
                }}
                className="space-y-1.5 pt-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="+ Add a subtask (press Enter)..."
                    value={inlineSubtaskTitle}
                    onChange={(e) => setInlineSubtaskTitle(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-[11px] bg-white/10 hover:bg-white/15 focus:bg-black/60 border border-white/20 focus:border-amber-400 rounded-lg text-white placeholder-white/40 focus:outline-none transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTimePicker(!showTimePicker)}
                    className={`p-1 rounded-lg border transition-all ${
                      showTimePicker || inlineSubtaskTime
                        ? 'bg-amber-400/20 text-amber-300 border-amber-400/50'
                        : 'bg-white/10 text-white/60 hover:text-white border-white/20'
                    }`}
                    title="Set subtask time"
                  >
                    <Clock className="w-3 h-3" />
                  </button>
                  <button
                    type="submit"
                    disabled={!inlineSubtaskTitle.trim()}
                    className="px-2.5 py-1 text-[10px] font-bold bg-amber-400 hover:bg-amber-300 disabled:opacity-30 disabled:hover:bg-amber-400 text-zinc-950 rounded-lg flex items-center gap-1 transition-all shadow-sm active:scale-95"
                    title="Add Subtask"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>

                {showTimePicker && (
                  <div className="flex items-center gap-2 pl-1">
                    <span className="text-[9px] font-mono text-white/50">Time:</span>
                    <input
                      type="time"
                      value={inlineSubtaskTime}
                      onChange={(e) => setInlineSubtaskTime(e.target.value)}
                      className="px-2 py-0.5 text-[10px] bg-black/50 border border-white/20 focus:border-amber-400 rounded text-white font-mono focus:outline-none"
                    />
                    {inlineSubtaskTime && (
                      <button
                        type="button"
                        onClick={() => setInlineSubtaskTime('')}
                        className="text-[9px] text-rose-300 hover:underline"
                      >
                        clear
                      </button>
                    )}
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
