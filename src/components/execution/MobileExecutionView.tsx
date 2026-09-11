'use client';

import React, { useState, useEffect } from 'react';
import { useActiveShutdown } from '@/context/ActiveShutdownContext';
import { ActivityExecutionDTO } from '@/core/execution/FieldExecutionService';
import { Play, CheckCircle, Clock, AlertTriangle, ShieldCheck, FileText, Lock, Unlock } from 'lucide-react';

export function MobileExecutionView() {
  const { activeShutdown } = useActiveShutdown();
  const [board, setBoard] = useState<ActivityExecutionDTO[]>([]);
  const [readiness, setReadiness] = useState<Record<string, { is_ready: boolean; blockers: string[] }>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    if (!activeShutdown?.id) return;
    setLoading(true);
    try {
      const boardRes = await fetch(`/api/execution/board?event_id=${activeShutdown.id}`).then((r) => r.json());
      const activities: ActivityExecutionDTO[] = boardRes.data || [];
      setBoard(activities);

      // Fetch readiness in bulk or individually
      const readinessMap: Record<string, { is_ready: boolean; blockers: string[] }> = {};
      await Promise.all(
        activities
          .filter(a => a.status === 'not_started' || a.status === 'released')
          .map(async (a) => {
            const r = await fetch(`/api/mobile/execute?activityId=${a.id}`).then(res => res.json());
            if (r.success) {
              readinessMap[a.id] = r.data;
            }
          })
      );
      setReadiness(readinessMap);
    } catch (err) {
      console.error('Failed to load mobile execution data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeShutdown?.id]);

  const handleAction = async (activityId: string, action: string) => {
    setActionLoading(activityId);
    try {
      const res = await fetch('/api/mobile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          action,
          eventId: activeShutdown?.id,
          requestId: `mob-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Action failed');
      } else {
        await fetchData();
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading execution board...</div>;

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <h1 className="text-xl font-bold mb-4">Mobile Execution</h1>
      <div className="space-y-4">
        {board.map(activity => {
          const r = readiness[activity.id];
          const isReady = r?.is_ready;
          const statusColors: Record<string, string> = {
            not_started: 'bg-gray-100 text-gray-800',
            released: 'bg-indigo-100 text-indigo-800',
            in_progress: 'bg-blue-100 text-blue-800',
            held: 'bg-red-100 text-red-800',
            completed: 'bg-green-100 text-green-800',
            verified: 'bg-teal-100 text-teal-800',
            closed: 'bg-gray-800 text-white'
          };
          
          return (
            <div key={activity.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{activity.activity_number || 'No Number'}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2">{activity.description}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[activity.status] || 'bg-gray-100'}`}>
                  {activity.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              {/* Readiness Indicator */}
              {(activity.status === 'not_started' || activity.status === 'released') && r && (
                <div className={`mt-2 p-2 rounded text-sm flex items-center ${isReady ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {isReady ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                  {isReady ? 'READY FOR EXECUTION' : 'NOT READY'}
                </div>
              )}
              {r?.blockers && r.blockers.length > 0 && (
                <ul className="mt-1 text-xs text-amber-700 list-disc list-inside">
                  {r.blockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {activity.status === 'not_started' && (
                  <button 
                    onClick={() => handleAction(activity.id, 'RELEASE')}
                    disabled={actionLoading === activity.id || !isReady}
                    className="flex-1 min-w-[100px] bg-indigo-600 text-white px-3 py-2 rounded flex items-center justify-center text-sm disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 mr-1" /> Release
                  </button>
                )}
                {(activity.status === 'not_started' || activity.status === 'released') && (
                  <button 
                    onClick={() => handleAction(activity.id, 'START')}
                    disabled={actionLoading === activity.id || (!isReady && activity.status === 'not_started')}
                    className="flex-1 min-w-[100px] bg-blue-600 text-white px-3 py-2 rounded flex items-center justify-center text-sm disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 mr-1" /> Start
                  </button>
                )}
                {activity.status === 'in_progress' && (
                  <>
                    <button 
                      onClick={() => handleAction(activity.id, 'COMPLETE')}
                      disabled={actionLoading === activity.id}
                      className="flex-1 min-w-[100px] bg-green-600 text-white px-3 py-2 rounded flex items-center justify-center text-sm disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Complete
                    </button>
                    <button 
                      onClick={() => handleAction(activity.id, 'HOLD')}
                      disabled={actionLoading === activity.id}
                      className="flex-1 min-w-[100px] bg-amber-500 text-white px-3 py-2 rounded flex items-center justify-center text-sm disabled:opacity-50"
                    >
                      <AlertTriangle className="w-4 h-4 mr-1" /> Hold
                    </button>
                  </>
                )}
                {activity.status === 'held' && (
                  <button 
                    onClick={() => handleAction(activity.id, 'RESUME')}
                    disabled={actionLoading === activity.id}
                    className="flex-1 min-w-[100px] bg-blue-600 text-white px-3 py-2 rounded flex items-center justify-center text-sm disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 mr-1" /> Resume
                  </button>
                )}
                {activity.status === 'completed' && (
                  <button 
                    onClick={() => handleAction(activity.id, 'VERIFY')}
                    disabled={actionLoading === activity.id}
                    className="flex-1 min-w-[100px] bg-teal-600 text-white px-3 py-2 rounded flex items-center justify-center text-sm disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4 mr-1" /> Verify (QA)
                  </button>
                )}
                {activity.status === 'verified' && (
                  <button 
                    onClick={() => handleAction(activity.id, 'CLOSE')}
                    disabled={actionLoading === activity.id}
                    className="flex-1 min-w-[100px] bg-gray-800 text-white px-3 py-2 rounded flex items-center justify-center text-sm disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" /> Close
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
