'use client';

import React from 'react';
import { Task } from 'gantt-task-react';

export const TaskListTable: React.FC<{
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
  onTaskChange: (task: Task) => void;
  onCreateTask: (name: string) => void;
}> = ({
  rowHeight,
  rowWidth,
  tasks,
  fontFamily,
  selectedTaskId,
  setSelectedTask,
  onTaskChange,
  onCreateTask,
}) => {
  const [ghostName, setGhostName] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleGhostSubmit = () => {
    if (ghostName.trim()) {
      onCreateTask(ghostName.trim());
      setGhostName('');
    }
  };

  const displayTasks = tasks.filter((t: any) => t.id !== 'placeholder');

  return (
    <div
      className="bg-white"
      style={{
        width: rowWidth,
        fontFamily: fontFamily,
        fontSize: '11px',
      }}
    >
      {displayTasks.map((task: any) => {
        const isSelected = selectedTaskId === task.id;
        const isProject = task.type === 'project';
        
        return (
          <div
            key={task.id}
            className={`flex items-center border-b border-[#dadada] hover:bg-[#f3f2f1] transition-colors group ${
              isSelected ? 'bg-[#c7e0f4] z-10' : ''
            }`}
            style={{ height: rowHeight }}
            onClick={() => setSelectedTask(task.id)}
          >
            {/* ⓘ Info Column */}
            <div className="w-8 flex-none border-r border-[#dadada] flex items-center justify-center text-[9px] text-[#605e5c]">
                {isProject ? '📁' : ''}
            </div>

            {/* Mode Column */}
            <div className="w-10 flex-none border-r border-[#dadada] flex items-center justify-center text-xs">
                <span className="text-[#2b7344]" title="Auto Scheduled">📅</span>
            </div>

            {/* Task Name */}
            <div className={`flex-1 min-w-[200px] px-2 border-r border-[#dadada] truncate overflow-hidden flex items-center ${isProject ? 'font-bold text-gray-900' : 'text-[#323130]'}`}>
                <input
                  type="text"
                  className="w-full bg-transparent border-none focus:outline-none focus:ring-0 truncate"
                  readOnly={isProject}
                  defaultValue={task.description || task.name}
                  onBlur={(e) => {
                    if (!isProject && e.target.value !== (task.description || task.name)) {
                      onTaskChange({ ...task, name: e.target.value });
                    }
                  }}
                />
            </div>

            {/* Duration */}
            <div className="w-20 flex-none px-2 border-r border-[#dadada] text-[#323130] truncate text-center">
                {task.durationDisplay || '1 day'}
            </div>

            {/* Start */}
            <div className="w-24 flex-none px-2 border-r border-[#dadada] text-[#323130] truncate text-center">
                {task.start.toLocaleDateString('en-GB')}
            </div>

            {/* Finish */}
            <div className="w-24 flex-none px-2 border-r border-[#dadada] text-[#323130] truncate text-center">
                {task.end.toLocaleDateString('en-GB')}
            </div>

            {/* Predecessors */}
            <div className="w-24 flex-none px-2 border-r border-[#dadada] text-[#323130] text-[10px] truncate px-1">
                {task.predecessorsDisplay || ''}
            </div>

            {/* Successors */}
            <div className="w-24 flex-none px-2 border-r border-[#dadada] text-[#323130] text-[10px] truncate px-1">
                {task.successorsDisplay || ''}
            </div>

            {/* Text1 - Notes */}
            <div className="w-32 flex-none px-2 border-r border-[#dadada] text-[#323130] text-[10px] truncate italic">
                {task.text1 || ''}
            </div>

            {/* Text2 - Responsible */}
            <div className="w-32 flex-none px-2 border-r border-[#dadada] text-[#323130] text-[10px] truncate">
                {task.text2 || ''}
            </div>

            {/* Resource Names */}
            <div className="w-32 flex-none px-2 text-[#323130] text-[10px] truncate pr-2 italic">
                {task.resourceNames || ''}
            </div>
          </div>
        );
      })}

      {/* Ghost Row for Inline Creation */}
      <div 
        className="flex items-center border-b border-[#dadada] bg-[#f9f9f9]/50 hover:bg-[#f3f2f1] transition-colors cursor-text pointer-events-auto relative z-20 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#2b7344] focus-within:ring-inset"
        style={{ height: rowHeight }}
        onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.focus();
        }}
      >
        <div className="w-8 flex-none border-r border-[#dadada] h-full" /> 
        <div className="w-10 flex-none border-r border-[#dadada] h-full" />
        <div className="flex-1 min-w-[200px] px-2 border-r border-[#dadada]">
            <input
                ref={inputRef}
                type="text"
                tabIndex={0}
                autoFocus={displayTasks.length === 0}
                placeholder="Click to add new task..."
                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 text-[#323130] placeholder-gray-300"
                value={ghostName}
                onChange={(e) => setGhostName(e.target.value)}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') handleGhostSubmit();
                }}
                onBlur={handleGhostSubmit}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            />
        </div>
        <div className="flex-1" />
      </div>

    </div>
  );
};
