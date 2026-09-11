'use client';

import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, Clock, AlertTriangle, ShieldCheck, FileText, User } from 'lucide-react';
import { format } from 'date-fns';

export function ExecutionHistoryTimeline({ activityId }: { activityId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/execution/history?activityId=${activityId}`);
        const data = await res.json();
        if (data.success) {
          setLogs(data.data || []);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };
    if (activityId) fetchLogs();
  }, [activityId]);

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading history...</div>;
  if (!logs.length) return <div className="p-4 text-sm text-gray-500">No execution history found.</div>;

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'RELEASE': return <FileText className="w-4 h-4 text-indigo-500" />;
      case 'START':
      case 'RESUME': return <Play className="w-4 h-4 text-blue-500" />;
      case 'UPDATE_PROGRESS': return <Clock className="w-4 h-4 text-gray-500" />;
      case 'HOLD': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'REPORT_DELAY': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'COMPLETE': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'VERIFY': return <ShieldCheck className="w-4 h-4 text-teal-500" />;
      case 'CLOSE': return <CheckCircle className="w-4 h-4 text-gray-800" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="relative border-l-2 border-slate-300 dark:border-slate-700 ml-4 pl-4 space-y-6">
      {logs.map((log, i) => (
        <div key={i} className="relative">
          <div className="absolute -left-[25px] bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            {getActionIcon(log.action)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{log.action.replace('_', ' ')}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{format(new Date(log.created_at), 'dd MMM yy HH:mm')}</span>
              {log.source_channel && (
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {log.source_channel}
                </span>
              )}
            </div>
            
            {log.progress !== null && log.progress !== undefined && (
              <div className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                Progress: <span className="font-medium">{log.progress}%</span>
              </div>
            )}
            
            {log.notes && (
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1 italic">
                "{log.notes}"
              </div>
            )}
            
            {log.audit?.user && (
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center">
                <User className="w-3 h-3 mr-1" />
                {log.audit.user.email}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
