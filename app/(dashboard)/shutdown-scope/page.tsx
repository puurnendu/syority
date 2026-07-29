'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Scope = {
  id: string;
  name: string;
  status: string;
  total_items: number;
  total_estimated_hrs: number;
  freeze_date: string | null;
  event: { id: string; name: string; code: string; planned_start: string | null; planned_end: string | null; status: string };
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  frozen: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-green-100 text-green-700',
};

export default function ShutdownScopeListPage() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchScopes = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('search', filter);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/shutdown-scope/scopes?${params}`);
    const data = await res.json();
    setScopes(data.data || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [filter, statusFilter]);

  useEffect(() => { fetchScopes(); }, [fetchScopes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Shutdown Scope Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage shutdown scope from engineering issues</p>
        </div>
        <Link
          href="/shutdown-scope/create"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 text-sm"
        >
          + Create Scope
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search scopes..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="frozen">Frozen</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Scope Cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading scopes...</div>
      ) : scopes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-gray-500 text-lg">No shutdown scopes found</p>
          <p className="text-gray-400 text-sm mt-1">Create a scope for an event to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {scopes.map((scope) => (
            <Link
              key={scope.id}
              href={`/shutdown-scope/${scope.id}`}
              className="block p-5 bg-white border rounded-xl hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{scope.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Event: {scope.event.name} ({scope.event.code})
                  </p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[scope.status] || ''}`}>
                  {scope.status.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-6 mt-3 text-sm text-gray-600">
                <span><strong>{scope.total_items}</strong> items</span>
                <span><strong>{scope.total_estimated_hrs.toLocaleString()}</strong> est. hours</span>
                {scope.freeze_date && (
                  <span>Freeze: <strong>{new Date(scope.freeze_date).toLocaleDateString()}</strong></span>
                )}
                {scope.event.planned_start && (
                  <span>Start: {new Date(scope.event.planned_start).toLocaleDateString()}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-right">{total} scope(s) total</p>
    </div>
  );
}
