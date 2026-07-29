'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ScopeBuilderPage() {
  const { scopeId } = useParams() as { scopeId: string };
  const router = useRouter();
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [aiRecs, setAiRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [addingMsg, setAddingMsg] = useState('');
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'hierarchy' | 'issues'>('hierarchy');

  const fetchHierarchy = useCallback(async () => {
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/builder/hierarchy`);
    setHierarchy(await res.json());
    setLoading(false);
  }, [scopeId]);

  const fetchIssues = useCallback(async () => {
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/builder/issues`);
    const data = await res.json();
    setIssues(data.data || []);
  }, [scopeId]);

  useEffect(() => { fetchHierarchy(); fetchIssues(); }, [fetchHierarchy, fetchIssues]);

  const toggleUnit = (id: string) => {
    const next = new Set(expandedUnits);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedUnits(next);
  };

  const toggleSystem = (id: string) => {
    const next = new Set(expandedSystems);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSystems(next);
  };

  const addAssetToScope = async (assetId: string, reason: string, issueIds: string[]) => {
    setAddingMsg('Adding...');
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId, reason, issue_ids: issueIds }),
    });
    if (res.ok) {
      setAddingMsg('✅ Added');
      fetchHierarchy();
      fetchIssues();
    } else {
      const err = await res.json();
      setAddingMsg(`❌ ${err.error}`);
    }
    setTimeout(() => setAddingMsg(''), 3000);
  };

  const bulkAdd = async () => {
    if (selectedIssues.size === 0) return;
    setAddingMsg('Bulk adding...');
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/items/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issue_ids: [...selectedIssues] }),
    });
    if (res.ok) {
      const result = await res.json();
      setAddingMsg(`✅ ${result.created} created, ${result.linked} linked`);
      setSelectedIssues(new Set());
      fetchHierarchy();
      fetchIssues();
    }
    setTimeout(() => setAddingMsg(''), 4000);
  };

  const fetchAiRecommendations = async () => {
    setAiLoading(true);
    const res = await fetch(`/api/shutdown-scope/scopes/${scopeId}/builder/ai-recommend`, { method: 'POST' });
    const data = await res.json();
    setAiRecs(data.recommendations || []);
    setAiLoading(false);
  };

  const toggleIssue = (id: string) => {
    const next = new Set(selectedIssues);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIssues(next);
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading builder...</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/shutdown-scope/${scopeId}`} className="text-xs text-blue-600 hover:underline">← Back to Scope</Link>
          <h1 className="text-xl font-bold text-gray-900 mt-1">🏗️ Scope Builder</h1>
          <p className="text-xs text-gray-500">
            {hierarchy?.totals?.in_scope || 0} of {hierarchy?.totals?.total_assets || 0} assets in scope
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAiRecommendations}
            disabled={aiLoading}
            className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {aiLoading ? '🤖 Analyzing...' : '🤖 AI Recommend'}
          </button>
        </div>
      </div>

      {addingMsg && <div className="p-2 text-sm bg-blue-50 border border-blue-200 rounded-lg text-blue-700">{addingMsg}</div>}

      {/* View Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setView('hierarchy')} className={`px-3 py-1.5 text-xs rounded-lg ${view === 'hierarchy' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Hierarchy View</button>
        <button onClick={() => setView('issues')} className={`px-3 py-1.5 text-xs rounded-lg ${view === 'issues' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          Issue View ({issues.length} unscoped)
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Left Panel */}
        <div className="col-span-2 bg-white border rounded-xl p-4 max-h-[70vh] overflow-y-auto">
          {view === 'hierarchy' ? (
            <div className="space-y-1">
              {hierarchy?.units?.map((unit: any) => (
                <div key={unit.id}>
                  <button onClick={() => toggleUnit(unit.id)} className="flex items-center gap-2 w-full text-left px-2 py-1.5 hover:bg-gray-50 rounded text-sm font-medium">
                    <span>{expandedUnits.has(unit.id) ? '▼' : '▶'}</span>
                    <span>🏭 {unit.name} ({unit.code})</span>
                  </button>
                  {expandedUnits.has(unit.id) && (
                    <div className="ml-6 space-y-1">
                      {unit.systems?.map((sys: any) => (
                        <div key={sys.id}>
                          <button onClick={() => toggleSystem(sys.id)} className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-sm">
                            <span>{expandedSystems.has(sys.id) ? '▼' : '▶'}</span>
                            <span>⚙️ {sys.name}</span>
                            <span className="text-xs text-gray-400">({sys.assets?.length || 0} assets)</span>
                          </button>
                          {expandedSystems.has(sys.id) && (
                            <div className="ml-6 space-y-0.5">
                              {sys.assets?.map((asset: any) => (
                                <div key={asset.id} className={`flex items-center justify-between px-2 py-1 rounded text-sm ${asset.in_scope ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                  <div className="flex items-center gap-2">
                                    <span>{asset.in_scope ? '✅' : '⬜'}</span>
                                    <span className="font-mono text-xs">{asset.tag_number}</span>
                                    <span className="text-gray-600">{asset.name}</span>
                                    {asset.issue_count > 0 && <span className="text-xs bg-orange-100 text-orange-600 px-1 rounded">{asset.issue_count} issues</span>}
                                  </div>
                                  {!asset.in_scope && (
                                    <button
                                      onClick={() => addAssetToScope(asset.id, `Engineering issues on ${asset.tag_number}`, [])}
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      + Add
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      {unit.assets?.map((asset: any) => (
                        <div key={asset.id} className={`flex items-center justify-between px-2 py-1 rounded text-sm ${asset.in_scope ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-2">
                            <span>{asset.in_scope ? '✅' : '⬜'}</span>
                            <span className="font-mono text-xs">{asset.tag_number}</span>
                            <span className="text-gray-600">{asset.name}</span>
                          </div>
                          {!asset.in_scope && (
                            <button onClick={() => addAssetToScope(asset.id, `Selected in scope builder`, [])} className="text-xs text-blue-600 hover:underline">+ Add</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">{issues.length} unscoped issues</span>
                {selectedIssues.size > 0 && (
                  <button onClick={bulkAdd} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Add {selectedIssues.size} Selected to Scope
                  </button>
                )}
              </div>
              {issues.map((issue: any) => (
                <label key={issue.id} className="flex items-start gap-2 p-2 hover:bg-gray-50 rounded text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedIssues.has(issue.id)} onChange={() => toggleIssue(issue.id)} className="mt-1 rounded" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-blue-600">{issue.asset?.tag_number}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        issue.priority === 'critical' ? 'bg-red-100 text-red-700' :
                        issue.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{issue.priority}</span>
                      {issue.department && <span className="text-xs text-gray-400">{issue.department}</span>}
                    </div>
                    <p className="text-gray-700 mt-0.5">{issue.problem?.slice(0, 200)}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel — AI Recommendations */}
        <div className="bg-white border rounded-xl p-4 max-h-[70vh] overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">🤖 AI Recommendations</h3>
          {aiRecs.length === 0 ? (
            <p className="text-xs text-gray-400">Click "AI Recommend" to analyze unscoped assets</p>
          ) : (
            <div className="space-y-3">
              {aiRecs.map((rec: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg text-xs ${rec.recommendation === 'include' ? 'bg-green-50 border border-green-200' : rec.recommendation === 'exclude' ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-medium">{rec.asset_tag}</span>
                    <span className={`font-bold ${rec.recommendation === 'include' ? 'text-green-700' : rec.recommendation === 'exclude' ? 'text-red-700' : 'text-yellow-700'}`}>
                      {rec.recommendation?.toUpperCase()} ({Math.round((rec.confidence || 0) * 100)}%)
                    </span>
                  </div>
                  <p className="text-gray-600 mt-1">{rec.reasoning}</p>
                  {rec.suggested_discipline && <p className="mt-1"><strong>Discipline:</strong> {rec.suggested_discipline}</p>}
                  {rec.grouping_hint && <p><strong>Grouping:</strong> {rec.grouping_hint}</p>}
                  {rec.missing_documents?.length > 0 && <p className="text-orange-600"><strong>Missing:</strong> {rec.missing_documents.join(', ')}</p>}
                  {rec.recommendation === 'include' && rec.asset_id && (
                    <button
                      onClick={() => addAssetToScope(rec.asset_id, rec.reasoning, [])}
                      className="mt-2 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      + Accept & Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
