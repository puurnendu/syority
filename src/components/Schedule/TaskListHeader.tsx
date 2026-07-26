'use client';

import React from 'react';

export const TaskListHeader: React.FC<{
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}> = ({ headerHeight, rowWidth, fontFamily, fontSize }) => {
  return (
    <div
      className="flex items-center border-b border-[#dadada] bg-[#fdfdfd] text-[#444444] font-normal leading-tight"
      style={{
        height: headerHeight,
        width: rowWidth,
        fontFamily: fontFamily,
        fontSize: '11px',
      }}
    >
      <div className="w-8 flex-none px-1 border-r border-[#dadada] text-center bg-[#fdfdfd]">ⓘ</div>
      <div className="w-10 flex-none px-1 border-r border-[#dadada] text-center bg-[#fdfdfd]">Mode</div>
      <div className="flex-1 min-w-[200px] px-2 border-r border-[#dadada] truncate">Task Name</div>
      <div className="w-20 flex-none px-2 border-r border-[#dadada] text-center truncate">Duration</div>
      <div className="w-24 flex-none px-2 border-r border-[#dadada] text-center truncate">Start</div>
      <div className="w-24 flex-none px-2 border-r border-[#dadada] text-center truncate">Finish</div>
      <div className="w-24 flex-none px-2 border-r border-[#dadada] text-center truncate pr-2">Predecessors</div>
      <div className="w-24 flex-none px-2 border-r border-[#dadada] text-center truncate pr-2">Successors</div>
      <div className="w-32 flex-none px-2 border-r border-[#dadada] text-center truncate pr-2">Text1 (Notes)</div>
      <div className="w-32 flex-none px-2 border-r border-[#dadada] text-center truncate pr-2">Text2 (Resp.)</div>
      <div className="w-32 flex-none px-2 text-center truncate pr-2">Resource Names</div>
    </div>
  );
};

