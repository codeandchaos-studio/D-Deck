import React, { useState, useRef, useLayoutEffect } from 'react';
import type { Task, AppSettings, StreakMetrics } from '../../types';
import { WidgetHeader } from './WidgetHeader';
import { TaskItem } from './TaskItem';
import { QuickAddModal } from './QuickAddModal';
import { EditTaskModal } from '../common/EditTaskModal';
import { Plus, Flame, CheckCircle2 } from 'lucide-react';

interface WidgetViewProps {
  tasks: Task[];
  settings: AppSettings;
  streak?: StreakMetrics;
  updateAvailable?: boolean;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
  onUpdateTask?: (updatedTask: Task) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onAddSubtask?: (taskId: string, title: string) => void;
  onDeleteSubtask?: (taskId: string, subtaskId: string) => void;
  onExpandToDeck: () => void;
  onToggleAlwaysOnTop: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

export const WidgetView: React.FC<WidgetViewProps> = ({
  tasks,
  settings,
  streak,
  updateAvailable,
  onAddTask,
  onUpdateTask,
  onToggleTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onExpandToDeck,
  onToggleAlwaysOnTop,
  onMinimize,
  onClose,
}) => {
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef<number>(0);

  // Dynamic Content-Adaptive Height: Auto-measure and resize Electron window
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const syncHeight = () => {
      const rectHeight = el.getBoundingClientRect().height;
      const roundedHeight = Math.ceil(rectHeight);
      if (roundedHeight > 0 && Math.abs(roundedHeight - lastHeightRef.current) >= 2) {
        lastHeightRef.current = roundedHeight;
        if (window.electronAPI?.setWidgetHeight) {
          window.electronAPI.setWidgetHeight(roundedHeight);
        }
      }
    };

    syncHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        syncHeight();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [tasks]);

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const handleOpenAdd = () => {
    if (window.electronAPI?.openQuickAdd) {
      window.electronAPI.openQuickAdd();
    } else {
      setIsQuickAddOpen(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-auto flex flex-col glass-surface rounded-2xl overflow-hidden font-sans select-none shadow-2xl"
    >
      <WidgetHeader
        onQuickAdd={handleOpenAdd}
        onExpandToDeck={onExpandToDeck}
        alwaysOnTop={settings.alwaysOnTop}
        updateAvailable={updateAvailable}
        onToggleAlwaysOnTop={onToggleAlwaysOnTop}
        onMinimize={onMinimize}
        onClose={onClose}
      />

      <div className="flex flex-col px-3 pt-2 pb-2.5 space-y-2">
        {/* Tasks Container with dynamic content-hugged height */}
        <div className="max-h-[380px] overflow-y-auto pr-0.5 space-y-1.5 scrollbar-thin">
          {tasks.length === 0 ? (
            <div className="py-3.5 px-2 flex flex-col items-center justify-center text-center text-white/70 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-amber-400">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">All clear</p>
                <p className="text-[10px] text-white/60">Capture what needs to be done</p>
              </div>
              <button
                onClick={handleOpenAdd}
                className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add task
              </button>
            </div>
          ) : (
            <>
              {pendingTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggleTask}
                  onDelete={onDeleteTask}
                  onEdit={(t) => setEditingTask(t)}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                />
              ))}

              {completedTasks.length > 0 && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[10px] font-mono text-emerald-400 font-semibold uppercase tracking-wider">
                      Done ({completedTasks.length})
                    </span>
                    <div className="flex-1 h-px bg-white/20" />
                  </div>
                  <div className="space-y-1.5">
                    {completedTasks.map(task => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={onToggleTask}
                        onDelete={onDeleteTask}
                        onEdit={(t) => setEditingTask(t)}
                        onToggleSubtask={onToggleSubtask}
                        onAddSubtask={onAddSubtask}
                        onDeleteSubtask={onDeleteSubtask}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Status directly hugged under the task list */}
        <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-white/80 font-sans">
          <div className="flex items-center gap-1.5" title="Local Streak Counter: 100% offline & private">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
            <span className="text-white font-semibold">{streak?.currentStreak ?? 0}d streak</span>
            <span className="text-white/40">•</span>
            <span className="text-emerald-400 font-mono text-[10px] font-bold">{streak?.weeklyVelocity ?? 0}/wk</span>
          </div>
          <div className="text-[10px] text-white/70 font-mono">
            <span>{pendingTasks.length} pending</span>
          </div>
        </div>
      </div>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAddTask={onAddTask}
      />

      <EditTaskModal
        isOpen={!!editingTask}
        task={editingTask}
        onClose={() => setEditingTask(null)}
        onSaveTask={(updated) => {
          if (onUpdateTask) onUpdateTask(updated);
        }}
      />
    </div>
  );
};
