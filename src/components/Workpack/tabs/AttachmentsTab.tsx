'use client';

import { useState, useEffect } from 'react';
import { ATTACHMENT_GROUPS, ATTACHMENT_GROUP_MAP, type AttachmentGroupKey } from '@/lib/attachments/attachmentGroups';

// Specialized Editors
import { MethodStatementEditor } from '../attachments/MethodStatementEditor';
import { JSASelector, JSAViewer } from '../attachments/JSAEditor';
import { TorquingChecklist } from '../attachments/TorquingChecklist';
import { FlangeBoxupChecklist } from '../attachments/FlangeBoxupChecklist';
import { HydrotestReport } from '../attachments/HydrotestReport';
import { DORTable } from '../attachments/DORTable';

interface Attachment {
  id: string;
  group: string;
  subGroup?: string | null;
  title: string;
  attachmentType: string;
  templateKey?: string | null;
  isActive: boolean;
  content?: any;
}

const GROUP_COLORS: Record<string, string> = {
  procedures:   'border-blue-200 bg-blue-50',
  jsas:         'border-red-200 bg-red-50',
  checklists:   'border-purple-200 bg-purple-50',
  reports:      'border-orange-200 bg-orange-50',
  certificates: 'border-green-200 bg-green-50',
};

export function AttachmentsTab({ workpackId }: { workpackId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<AttachmentGroupKey>('procedures');
  const [loading, setLoading] = useState(true);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);

  const loadAttachments = async () => {
    try {
      const res = await fetch(`/api/workpacks/${workpackId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(Array.isArray(data) ? data : (data.attachments ?? []));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workpackId]);

  const toggleAttachment = async (id: string, isActive: boolean) => {
    await fetch(`/api/workpacks/${workpackId}/attachments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    loadAttachments();
  };

  const addTemplate = async (templateKey: string, title: string, group: string) => {
    if (templateKey === 'method_statement') {
        const res = await fetch(`/api/workpacks/${workpackId}/attachments/generate-method-statement`, { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            setEditingAttachment(data.attachment);
        }
    } else if (templateKey !== 'jsa_library') {
        await fetch(`/api/workpacks/${workpackId}/attachments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateKey, title, group, attachmentType: 'template', isActive: true }),
        });
    }
    loadAttachments();
  };

  const saveAttachmentContent = async (id: string, content: any) => {
    await fetch(`/api/workpacks/${workpackId}/attachments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });
    loadAttachments();
    setEditingAttachment(null);
  };

  const currentGroup = ATTACHMENT_GROUP_MAP[selectedGroup];
  const groupAttachments = attachments.filter((a) => a.group === selectedGroup && a.isActive);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading attachments...</div>;

  if (editingAttachment) {
      return (
          <div className="bg-white rounded-3xl p-8 max-w-6xl mx-auto border shadow-2xl relative">
              <button 
                  onClick={() => setEditingAttachment(null)}
                  className="absolute top-8 right-8 text-xs font-black text-gray-400 hover:text-gray-900 uppercase tracking-widest border border-gray-100 rounded-xl px-4 py-2 bg-gray-50 transition-all"
              >
                  Close Editor
              </button>
              
              {editingAttachment.templateKey === 'method_statement' && (
                  <MethodStatementEditor 
                      workpackId={workpackId} 
                      content={editingAttachment.content} 
                      onSave={(c) => saveAttachmentContent(editingAttachment.id, c)} 
                  />
              )}
              {editingAttachment.templateKey === 'torquing_checklist' && (
                  <TorquingChecklist 
                      workpackId={workpackId} 
                      content={editingAttachment.content ?? { title: editingAttachment.title, rows: [] }} 
                      onSave={(c) => saveAttachmentContent(editingAttachment.id, c)} 
                  />
              )}
              {editingAttachment.templateKey === 'flange_boxup' && (
                  <FlangeBoxupChecklist 
                      workpackId={workpackId} 
                      content={editingAttachment.content ?? { title: editingAttachment.title, rows: [] }} 
                      onSave={(c) => saveAttachmentContent(editingAttachment.id, c)} 
                  />
              )}
              {editingAttachment.templateKey === 'hydrotest_report' && (
                  <HydrotestReport 
                      workpackId={workpackId} 
                      content={editingAttachment.content ?? { equipmentTag: 'Exchanger', reportNumber: '', testDate: '', fluid: 'Water', temp: 'Ambient', dur: '30 min', shellSide: {}, tubeSide: {} }} 
                      onSave={(c) => saveAttachmentContent(editingAttachment.id, c)} 
                  />
              )}
              {editingAttachment.templateKey === 'dor_table' && (
                  <DORTable 
                      workpackId={workpackId} 
                      content={editingAttachment.content ?? { title: editingAttachment.title, rows: [] }} 
                      onSave={(c) => saveAttachmentContent(editingAttachment.id, c)} 
                  />
              )}
              {editingAttachment.group === 'jsas' && (
                  <JSAViewer content={editingAttachment.content} />
              )}

              <div className="mt-12 pt-8 border-t border-gray-100 flex justify-center">
                 <button onClick={() => setEditingAttachment(null)} className="text-sm font-bold text-gray-400 hover:text-indigo-600 transition-colors">
                    Return to Document Index
                 </button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-full min-h-[600px] border rounded-3xl overflow-hidden bg-white shadow-sm ring-1 ring-black/5">
      <div className="w-72 border-r border-gray-100 bg-gray-50/50 flex-shrink-0">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">Attachment Index</h3>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">DISCIPLINE GROUPS</p>
        </div>
        <nav className="p-3 space-y-1.5">
          {ATTACHMENT_GROUPS.map((group) => {
            const count = attachments.filter((a) => a.group === group.key && a.isActive).length;
            return (
              <button
                key={group.key}
                onClick={() => setSelectedGroup(group.key as AttachmentGroupKey)}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm transition-all group ${
                  selectedGroup === group.key
                    ? 'bg-white shadow-md ring-1 ring-gray-200 text-indigo-600 font-black translate-x-1'
                    : 'text-gray-500 hover:bg-gray-200/50 hover:text-gray-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`text-xl transition-transform group-hover:scale-110 ${selectedGroup === group.key ? 'grayscale-0' : 'grayscale'}`}>{group.icon}</span>
                  {group.label}
                </span>
                {count > 0 && (
                  <span className="text-[10px] bg-indigo-600 text-white rounded-full px-2 py-0.5 min-w-[1.5rem] font-black shadow-lg shadow-indigo-200">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto flex flex-col bg-white">
        <div className={`p-8 border-b border-gray-100 ${GROUP_COLORS[selectedGroup] ?? 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-3 bg-white rounded-2xl shadow-sm">{currentGroup.icon}</span>
                <div>
                   <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                    {currentGroup.label}
                   </h3>
                   <p className="text-xs text-gray-500 mt-0.5 max-w-md font-medium">{currentGroup.description}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 opacity-60">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SECTION STATS</span>
              <div className="flex items-center gap-2 text-[10px] font-black px-3 py-1 bg-white border border-current/10 rounded-full">
                 {groupAttachments.length} Document(s) active
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          {groupAttachments.length > 0 ? (
            <div className="mb-12">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                <span className="w-8 h-[2px] bg-gray-100"></span>
                Assigned Documents in this Section
              </h4>
              <div className="space-y-3">
                {groupAttachments.map((att, i) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-5 bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-xl hover:border-indigo-100 transition-all group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="text-[10px] font-black text-gray-300 w-5">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1">
                      <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{att.title}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                         <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter shadow-sm">
                            {att.attachmentType}
                         </span>
                         {att.templateKey && (
                            <span className="text-[9px] text-indigo-500 font-black uppercase tracking-widest opacity-60">
                               Ref: {att.templateKey}
                            </span>
                         )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                      <button
                        onClick={() => setEditingAttachment(att)}
                        type="button"
                        className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-4 py-2 rounded-xl border border-indigo-100 transition-colors uppercase tracking-widest"
                      >
                        Open Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttachment(att.id, false)}
                        className="text-[10px] font-black text-red-400 hover:bg-red-50 hover:text-red-600 px-3 py-2 rounded-xl transition-colors uppercase tracking-widest"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-12 py-20 border-2 border-dashed border-gray-100 rounded-[32px] flex flex-col items-center justify-center text-center bg-gray-50/30 animate-in fade-in zoom-in-95 duration-700">
               <span className="text-5xl grayscale opacity-10 mb-6 drop-shadow-sm">{currentGroup.icon}</span>
               <p className="text-sm font-black text-gray-400 uppercase tracking-tight">Empty Section Index</p>
               <p className="text-[10px] text-gray-300 mt-2 max-w-[240px] font-bold leading-relaxed uppercase tracking-wider">Use technical templates below to populate this discipline group.</p>
            </div>
          )}

          <div>
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-3">
              <span className="w-8 h-[2px] bg-gray-100"></span>
              Technical Document Templates
            </h4>
            
            {selectedGroup === 'jsas' ? (
                <JSASelector 
                    workpackId={workpackId} 
                    existingJSAs={attachments.map(a => a.templateKey).filter(Boolean) as string[]} 
                    onAdded={loadAttachments} 
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentGroup.templates.map((tmpl) => {
                    const alreadyAdded = attachments.some(
                    (a) => a.templateKey === tmpl.key && a.isActive
                    );
                    return (
                    <button
                        key={tmpl.key}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addTemplate(tmpl.key, tmpl.label, selectedGroup)}
                        className={`group flex flex-col items-start gap-4 p-6 rounded-[32px] border transition-all text-left ${
                        alreadyAdded
                            ? 'border-green-100 bg-green-50/30 text-green-700 cursor-default shadow-sm ring-1 ring-green-100'
                            : 'border-gray-100 bg-white hover:border-indigo-300 hover:shadow-2xl hover:-translate-y-1'
                        }`}
                    >
                        <div className={`p-3 rounded-2xl border transition-colors ${alreadyAdded ? 'bg-green-500 border-green-400 text-white' : 'bg-gray-50 border-gray-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 text-gray-400 group-hover:text-indigo-500'}`}>
                            <span className="text-xl">{alreadyAdded ? '✓' : '📄'}</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-black text-sm uppercase tracking-tight">{tmpl.label}</p>
                            <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest leading-none">
                                {alreadyAdded ? 'Successfully Indexed' : 'Click to generate'}
                            </p>
                        </div>
                        {!alreadyAdded && (
                            <div className="mt-2 w-full h-8 flex items-center justify-end">
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                    Generate Component →
                                </span>
                            </div>
                        )}
                    </button>
                    );
                })}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
