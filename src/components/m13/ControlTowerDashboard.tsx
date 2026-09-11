'use client';

import React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SCurveChart } from '@/components/Schedule/SCurveChart';
import type { ControlTowerSummary, ControlTowerException } from '@/core/control-tower/ControlTowerQueryService';
import type { ExceptionCode } from '@/core/control-tower/ControlTowerRules';

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
});

export function ControlTowerDashboard({ eventId }: { eventId: string }) {
  const { data, error, isLoading } = useSWR<ControlTowerSummary>(
    `/api/m13/control-tower/summary?eventId=${eventId}`,
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading Control Tower...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load control tower data.</AlertDescription>
      </Alert>
    );
  }

  const { progress, schedule, exceptions, identicalActivities } = data;

  const renderExceptionBadge = (code: ExceptionCode, severity: string) => {
    const colors: Record<string, string> = {
      P1: 'bg-red-100 text-red-800',
      P2: 'bg-orange-100 text-orange-800',
      P3: 'bg-yellow-100 text-yellow-800',
      P4: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`ml-2 inline-block px-2 py-0.5 rounded text-[10px] font-bold ${colors[severity] || 'bg-gray-100 text-gray-800'}`}>
        {code.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats (Drillable to Workspace via URL parameters) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Link href={`/planner-workspace?eventId=${eventId}&view=execution`}>
          <Card className="hover:border-blue-500 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Overall Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{progress.overallProgress}%</div>
              <p className="text-xs text-muted-foreground">Duration-weighted</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href={`/planner-workspace?eventId=${eventId}&filter=critical`}>
          <Card className="hover:border-red-500 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Critical Path</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{schedule.criticalPathCount}</div>
              <p className="text-xs text-muted-foreground">Active critical activities</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/planner-workspace?eventId=${eventId}&filter=late`}>
          <Card className="hover:border-red-500 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Late Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{schedule.lateCount}</div>
              <p className="text-xs text-muted-foreground">Past planned end date</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/planner-workspace?eventId=${eventId}&filter=constraint_blocked`}>
          <Card className="hover:border-orange-500 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Constraints</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {exceptions.filter(e => e.reason === 'CONSTRAINT_BLOCKED').length}
              </div>
              <p className="text-xs text-muted-foreground">Active critical constraints</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/planner-workspace?eventId=${eventId}&filter=readiness_blocked`}>
          <Card className="hover:border-yellow-500 transition-colors cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Readiness Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">
                {exceptions.filter(e => e.reason === 'READINESS_BLOCKED').length}
              </div>
              <p className="text-xs text-muted-foreground">Missing permits / predecessors</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Lookahead Horizons */}
      {data.lookahead && data.lookahead.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lookahead Intelligence (Cumulative)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {data.lookahead.map((bin) => (
                <div key={bin.horizon} className="p-4 border rounded shadow-sm flex flex-col space-y-2">
                  <div className="font-bold text-lg text-center border-b pb-2">{bin.horizon}</div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Upcoming:</span>
                    <span className="font-bold">{bin.upcomingActivitiesCount}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Actual Prog:</span>
                    <span className="font-bold">{bin.actualPercent}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Plan Prog:</span>
                    <span className="font-bold text-gray-400">
                      {bin.plannedPercent !== null ? `${bin.plannedPercent}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-2 pt-2 border-t">
                    <span className="text-red-500 font-medium">Late/At Risk:</span>
                    <span className={bin.lateAtRiskCount > 0 ? "font-bold text-red-600" : "font-bold text-gray-500"}>
                      {bin.lateAtRiskCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-yellow-600 font-medium">Unready:</span>
                    <span className={bin.unreadyCount > 0 ? "font-bold text-yellow-600" : "font-bold text-gray-500"}>
                      {bin.unreadyCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* S-Curve Chart (M8.10 Event EVM, M13 presentation) */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule Performance (S-Curve)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <SCurveChart eventId={eventId} />
          </CardContent>
        </Card>

        {/* Predictive Exceptions List */}
        <Card>
          <CardHeader>
            <CardTitle>Management Exceptions</CardTitle>
          </CardHeader>
          <CardContent className="max-h-80 overflow-auto">
            {exceptions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No exceptions detected.
              </div>
            ) : (
              <div className="space-y-3">
                {exceptions.map((ex) => (
                  <div 
                    key={ex.activityId} 
                    className="flex justify-between items-center p-3 rounded border text-sm"
                  >
                    <div>
                      <div className="font-semibold">
                        <Link href={`/planner-workspace?eventId=${eventId}&search=${ex.activityIdCode}`} className="hover:underline">
                          {ex.activityIdCode || ex.activityId.substring(0, 8)}
                        </Link>
                        {renderExceptionBadge(ex.reason, ex.severity)}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {ex.description || 'No description'}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 flex gap-2">
                        {ex.workpackName && <span>WP: {ex.workpackName}</span>}
                        {ex.equipmentName && <span>EQ: {ex.equipmentName}</span>}
                        {ex.unitCode && <span>Unit: {ex.unitCode}</span>}
                      </div>
                    </div>
                    <div className="text-right text-xs space-y-1 ml-4 whitespace-nowrap">
                      <div><span className="font-medium text-gray-500">SPI:</span> <span className={(ex.spi ?? 1) < 1.0 ? 'text-red-600 font-bold' : ''}>{ex.spi !== null ? ex.spi.toFixed(2) : 'N/A'}</span></div>
                      <div><span className="font-medium text-gray-500">Float:</span> <span className={ex.totalFloat <= 0 ? 'text-red-600 font-bold' : ''}>{ex.totalFloat}h</span></div>
                      <div><span className="font-medium text-gray-500">Prog:</span> {ex.progressPercent}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance by Discipline and Contractor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {data.byDiscipline && data.byDiscipline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Discipline Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-auto pr-2">
                {data.byDiscipline.map(d => (
                  <div key={d.key} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <div className="font-semibold text-sm">
                        <Link href={`/planner-workspace?eventId=${eventId}&view=execution&disciplineId=${d.key}`} className="hover:underline">
                          {d.label}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {d.metrics.completedActivities} / {d.metrics.totalActivities} tasks completed
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{d.metrics.weightedProgress}%</div>
                      <div className="text-xs text-muted-foreground">{d.metrics.totalDurationHours} hrs</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.byContractor && data.byContractor.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Contractor Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-auto pr-2">
                {data.byContractor.map(c => (
                  <div key={c.key} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <div className="font-semibold text-sm">
                        <Link href={`/planner-workspace?eventId=${eventId}&view=execution&contractorId=${c.key}`} className="hover:underline">
                          {c.label}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.metrics.completedActivities} / {c.metrics.totalActivities} tasks completed
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{c.metrics.weightedProgress}%</div>
                      <div className="text-xs text-muted-foreground">{c.metrics.totalDurationHours} hrs</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Identical Activities (Bundle Pullout, Blinding, etc.) */}
      {identicalActivities && identicalActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Identical Activity Intelligence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {identicalActivities.map((group, idx) => (
                <div key={idx} className="p-4 border rounded shadow-sm">
                  <div className="font-bold text-sm mb-2">{group.standardActivityTypeName} - {group.equipmentType}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Total:</span> <span>{group.totalInstances}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Progress:</span> <span className="font-bold">{group.metrics.weightedProgress}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Completed:</span> <span>{group.completedInstances}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Balance:</span> <span>{group.notStartedInstances + group.inProgressInstances}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
