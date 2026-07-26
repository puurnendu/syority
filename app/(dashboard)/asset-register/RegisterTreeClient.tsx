'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterTreeClient({ initialSites, initialPlants }: { initialSites: any[], initialPlants: any[] }) {
  const router = useRouter();
  
  // State for forms
  const [editingNode, setEditingNode] = useState<{ id: string, type: string, name: string, code?: string, tag_number?: string, parentId?: string, asset_type?: string } | null>(null);
  const [addingTo, setAddingTo] = useState<{ type: string, parentId?: string, parentType?: string } | null>(null);
  const [formData, setFormData] = useState({ name: '', code: '', tag_number: '', asset_type: '' });
  
  const [isLoading, setIsLoading] = useState(false);

  // We rely on router.refresh() to get updated data, but we can also maintain local optimistic state if needed.
  // For simplicity, we'll just wait for router.refresh()

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (editingNode) {
        // PUT
        const res = await fetch(`/api/hierarchy/${editingNode.type}/${editingNode.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) throw new Error(await res.text());
      } else if (addingTo) {
        // POST
        const payload: any = { ...formData };
        if (addingTo.type === 'plant') payload.site_id = addingTo.parentId;
        if (addingTo.type === 'unit') {
          payload.plant_id = addingTo.parentId;
          payload.site_id = initialPlants.find(p => p.id === addingTo.parentId)?.site_id;
        }
        if (addingTo.type === 'system') {
          payload.unit_id = addingTo.parentId;
          payload.site_id = initialPlants.find(p => p.units.some((u: any) => u.id === addingTo.parentId))?.site_id;
        }
        if (addingTo.type === 'asset') {
          payload.system_id = addingTo.parentId;
          // find site_id
          for (const p of initialPlants) {
            for (const u of p.units) {
              if (u.systems.some((s: any) => s.id === addingTo.parentId)) {
                payload.site_id = p.site_id;
                break;
              }
            }
          }
        }
        const res = await fetch(`/api/hierarchy/${addingTo.type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(await res.text());
      }
      setEditingNode(null);
      setAddingTo(null);
      setFormData({ name: '', code: '', tag_number: '', asset_type: '' });
      router.refresh();
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/hierarchy/${type}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (e: any) {
      alert('Error deleting: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderForm = () => {
    return (
      <div className="my-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
        <div className="mb-2 font-bold text-gray-700">
          {editingNode ? `Edit ${editingNode.type}` : `Add ${addingTo?.type}`}
        </div>
        
        {(addingTo?.type === 'asset' || editingNode?.type === 'asset') ? (
          <>
            <input 
              type="text" placeholder="Tag Number" 
              className="w-full mb-2 p-1 border rounded"
              value={formData.tag_number} onChange={e => setFormData({ ...formData, tag_number: e.target.value })} 
            />
            <input 
              type="text" placeholder="Description/Name" 
              className="w-full mb-2 p-1 border rounded"
              value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} 
            />
            <input 
              type="text" placeholder="Asset Type (e.g. Pump)" 
              className="w-full mb-2 p-1 border rounded"
              value={formData.asset_type} onChange={e => setFormData({ ...formData, asset_type: e.target.value })} 
            />
          </>
        ) : (
          <>
            <input 
              type="text" placeholder="Name" 
              className="w-full mb-2 p-1 border rounded"
              value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} 
            />
            <input 
              type="text" placeholder="Code (optional)" 
              className="w-full mb-2 p-1 border rounded"
              value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} 
            />
          </>
        )}
        
        <div className="flex gap-2">
          <button disabled={isLoading} onClick={handleSave} className="bg-blue-600 text-white px-2 py-1 rounded">Save</button>
          <button disabled={isLoading} onClick={() => { setEditingNode(null); setAddingTo(null); }} className="bg-gray-200 px-2 py-1 rounded">Cancel</button>
        </div>
      </div>
    );
  };

  const NodeActions = ({ type, id, name, code, tag_number, asset_type, childType }: { type: string, id: string, name: string, code?: string, tag_number?: string, asset_type?: string, childType?: string }) => (
    <div className="hidden group-hover:flex items-center gap-1 ml-auto shrink-0 bg-white pl-1">
      {childType && (
        <button 
          title={`Add ${childType}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddingTo({ type: childType, parentId: id, parentType: type }); setFormData({ name: '', code: '', tag_number: '', asset_type: '' }); }} 
          className="text-green-600 hover:text-green-800 p-0.5 rounded hover:bg-green-50"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        </button>
      )}
      <button 
        title="Edit"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingNode({ id, type, name, code, tag_number, asset_type }); setFormData({ name, code: code || '', tag_number: tag_number || '', asset_type: asset_type || '' }); }} 
        className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-50"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </button>
      <button 
        title="Delete"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(type, id); }} 
        className="text-red-600 hover:text-red-800 p-0.5 rounded hover:bg-red-50"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Hierarchy</h2>
        <button 
          onClick={() => { setAddingTo({ type: 'site' }); setFormData({ name: '', code: '', tag_number: '', asset_type: '' }); }}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Site
        </button>
      </div>

      {addingTo?.type === 'site' && renderForm()}

      {initialSites.map((site) => (
        <div key={site.id} className="text-sm">
          {editingNode?.id === site.id ? renderForm() : (
            <div className="flex items-center group py-0.5 hover:bg-gray-50 rounded px-1 -mx-1">
              <span className="font-bold text-gray-800">{site.name}</span>
              <NodeActions type="site" id={site.id} name={site.name} code={site.code} childType="plant" />
            </div>
          )}
          
          {addingTo?.parentId === site.id && addingTo.type === 'plant' && renderForm()}

          <div className="mt-1 pl-3 border-l-2 border-gray-100 space-y-1 relative left-1.5">
            {initialPlants
              .filter((p) => p.site_id === site.id)
              .map((plant) => (
                <div key={plant.id}>
                  {editingNode?.id === plant.id ? renderForm() : (
                    <div className="flex items-center group py-0.5 hover:bg-gray-50 rounded px-1 -mx-1">
                      <span className="text-gray-700 font-semibold text-xs uppercase tracking-wide">{plant.name}</span>
                      <NodeActions type="plant" id={plant.id} name={plant.name} code={plant.code} childType="unit" />
                    </div>
                  )}

                  {addingTo?.parentId === plant.id && addingTo.type === 'unit' && renderForm()}

                  <div className="pl-3 border-l-2 border-gray-100 mt-1 relative left-1.5 space-y-1">
                    {plant.units.map((unit: any) => (
                      <div key={unit.id}>
                        {editingNode?.id === unit.id ? renderForm() : (
                          <div className="flex items-center group py-0.5 hover:bg-gray-50 rounded px-1 -mx-1">
                            <span className="text-gray-600 text-xs font-medium">{unit.name}</span>
                            <NodeActions type="unit" id={unit.id} name={unit.name} code={unit.code} childType="system" />
                          </div>
                        )}

                        {addingTo?.parentId === unit.id && addingTo.type === 'system' && renderForm()}

                        <div className="pl-3 border-l-2 border-gray-100 mt-1 relative left-1.5">
                          {unit.systems.map((sys: any) => (
                            <div key={sys.id} className="mb-1">
                              {editingNode?.id === sys.id ? renderForm() : (
                                <div className="flex items-center group py-0.5 hover:bg-gray-50 rounded px-1 -mx-1">
                                  <span className="text-gray-500 text-[11px] font-medium">{sys.name}</span>
                                  <NodeActions type="system" id={sys.id} name={sys.name} code={sys.code} childType="asset" />
                                </div>
                              )}

                              {addingTo?.parentId === sys.id && addingTo.type === 'asset' && renderForm()}

                              <div className="pl-3 mt-0.5 relative left-1.5 flex flex-col gap-0.5">
                                {sys.assets.map((a: any) => (
                                  <div key={a.id}>
                                    {editingNode?.id === a.id ? renderForm() : (
                                      <Link
                                        href={`/asset-register/${a.id}`}
                                        className="flex items-center group py-0.5 hover:bg-blue-50 rounded px-1 -mx-1"
                                      >
                                        <span className="block text-blue-600 text-[11px] truncate w-full pr-10">
                                          <span className="font-bold">{a.tag_number}</span> — {a.name}
                                        </span>
                                        <NodeActions type="asset" id={a.id} name={a.name} tag_number={a.tag_number} asset_type={a.asset_type} />
                                      </Link>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
      {initialSites.length === 0 && !addingTo && (
        <div className="text-xs text-gray-400 italic py-4 text-center">No hierarchy defined yet. Add a site to begin.</div>
      )}
    </div>
  );
}
