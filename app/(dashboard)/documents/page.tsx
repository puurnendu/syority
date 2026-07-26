'use client';
import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const CATEGORIES = ['All', 'Drawings', 'Datasheets', 'Procedures', 'Vendor Documents', 'Reports', 'Client Documents', 'General'];

const CATEGORY_ICONS: Record<string, string> = {
  Drawings: '📐', Datasheets: '📋', Procedures: '📖',
  'Vendor Documents': '🏭', Reports: '📊', 'Client Documents': '📁', General: '📄',
};

function fileIcon(mime: string) {
  if (mime?.includes('pdf'))   return '📄';
  if (mime?.includes('image')) return '🖼️';
  if (mime?.includes('sheet') || mime?.includes('excel')) return '📊';
  if (mime?.includes('word'))  return '📝';
  return '📎';
}

function fileSize(bytes: number) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

export default function DocumentLibraryPage() {
  const { data: session }  = useSession();
  const user               = session?.user as any;
  const role               = (user?.role ?? '').toUpperCase();
  const canUpload          = user?.is_super_admin || role === 'SUPER_ADMIN' || role === 'PLANNER' || role === 'ADMIN';

  const [docs,        setDocs]        = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [category,    setCategory]    = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearch,    setAiSearch]    = useState(false);
  const [searching,   setSearching]   = useState(false);
  const [showUpload,  setShowUpload]  = useState(false);
  const [events,      setEvents]      = useState<any[]>([]);
  const [preview,     setPreview]     = useState<any>(null);

  const loadDocs = async (cat?: string, q?: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cat && cat !== 'All') params.set('category', cat);
    if (q) params.set('q', q);
    const res  = await fetch(`/api/documents?${params}`);
    const data = await res.json();
    setDocs(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const aiSearchDocs = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    const res  = await fetch('/api/documents/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: q }),
    });
    const data = await res.json();
    setDocs(data.results ?? []);
    setAiSearch(true);
    setSearching(false);
  };

  useEffect(() => {
    loadDocs();
    fetch('/api/events').then(r => r.json()).then(d => setEvents(Array.isArray(d) ? d : []));
  }, []);

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    setAiSearch(false);
    loadDocs(cat, searchQuery);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) { loadDocs(category); setAiSearch(false); return; }
    aiSearchDocs(searchQuery);
  };

  const download = async (doc: any) => {
    window.open(`/api/documents/${doc.id}/download`, '_blank');
  };

  const deleteDoc = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    setDocs(d => d.filter(doc => doc.id !== id));
  };

  // Group by category for sidebar counts
  const categoryCounts = CATEGORIES.slice(1).reduce((acc, cat) => {
    acc[cat] = docs.filter(d => d.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex h-full min-h-screen">

      {/* ── LEFT SIDEBAR ── */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-4 space-y-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Categories</p>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => handleCategoryChange(cat)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
              category === cat ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            <span className="flex items-center gap-2">
              <span>{cat === 'All' ? '🗂️' : CATEGORY_ICONS[cat]}</span>
              {cat}
            </span>
            {cat !== 'All' && categoryCounts[cat] > 0 && (
              <span className="text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{categoryCounts[cat]}</span>
            )}
          </button>
        ))}
        <div className="pt-4 border-t border-gray-200 mt-4">
          <button onClick={() => handleCategoryChange('All')}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-2">
            <span>🏢</span> Org Library
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Document Library</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
              {aiSearch && <span className="ml-2 text-indigo-500 font-medium">· AI search results</span>}
            </p>
          </div>
          {canUpload && (
            <button onClick={() => setShowUpload(true)}
              className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 flex items-center gap-2">
              📤 Upload Document
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, content, equipment tag, document number..."
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); loadDocs(category); setAiSearch(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
            )}
          </div>
          <button onClick={handleSearch} disabled={searching}
            className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {searching ? <span className="animate-spin">⟳</span> : '🔍'} {searching ? 'Searching...' : 'AI Search'}
          </button>
        </div>

        {/* Documents grid */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading documents…</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-4xl mb-3">🗂️</p>
            <p className="text-gray-500 font-medium">No documents yet</p>
            <p className="text-xs text-gray-400 mt-1">
              {canUpload ? 'Click "Upload Document" to add files' : 'Documents will appear here once uploaded'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {docs.map(doc => (
              <div key={doc.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow group">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">{fileIcon(doc.mime_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate" title={doc.title}>{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                        {CATEGORY_ICONS[doc.category]} {doc.category}
                      </span>
                      {doc.revision && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                          Rev {doc.revision}
                        </span>
                      )}
                    </div>
                    {doc.document_number && (
                      <p className="text-xs text-gray-400 mt-1 font-mono">{doc.document_number}</p>
                    )}
                    {doc.ai_summary && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{doc.ai_summary}</p>
                    )}
                    {doc.equipment_tags?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {doc.equipment_tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-mono">
                            {tag}
                          </span>
                        ))}
                        {doc.equipment_tags.length > 3 && (
                          <span className="text-xs text-gray-400">+{doc.equipment_tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-400">
                    {fileSize(doc.file_size ?? 0)} · {doc.downloads} downloads
                    <br />
                    {doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleDateString('en-IN')}
                  </div>
                  <div className="flex gap-2">
                    {doc.mime_type?.includes('pdf') || doc.mime_type?.includes('image') ? (
                      <button onClick={() => setPreview(doc)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                        Preview
                      </button>
                    ) : null}
                    <button onClick={() => download(doc)}
                      className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 font-medium">
                      ↓ Download
                    </button>
                    {canUpload && (
                      <button onClick={() => deleteDoc(doc.id)}
                        className="text-xs text-red-400 hover:text-red-600">
                        🗑
                      </button>
                    )}
                  </div>
                </div>
                {doc.ai_indexed && (
                  <div className="mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    <span className="text-[10px] text-gray-400">AI indexed — searchable by content</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── UPLOAD MODAL ── */}
      {showUpload && (
        <UploadModal
          events={events}
          onUploaded={() => { setShowUpload(false); loadDocs(category); }}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* ── PREVIEW MODAL ── */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900 truncate">{preview.title}</p>
              <div className="flex gap-3">
                <button onClick={() => download(preview)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">
                  ↓ Download
                </button>
                <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {preview.mime_type?.includes('pdf') ? (
                <iframe src={`/api/documents/${preview.id}/download?inline=1`} className="w-full h-[75vh]" title={preview.title} />
              ) : (
                <img src={`/api/documents/${preview.id}/download?inline=1`} alt={preview.title} className="max-w-full mx-auto p-4" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPLOAD MODAL ──────────────────────────────────────────────────
function UploadModal({ events, onUploaded, onClose }: {
  events: any[]; onUploaded: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'General',
    revision: '', document_number: '', event_id: '',
    equipment_tags: '', is_org_library: false,
  });
  const [file,       setFile]       = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState('');
  const [dragOver,   setDragOver]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleFile = (f: File) => {
    setFile(f);
    if (!form.title) set('title', f.name.replace(/\.[^.]+$/, ''));
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));

    const res  = await fetch('/api/documents', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Upload failed'); setUploading(false); return; }
    setUploading(false);
    onUploaded();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">📤 Upload Document</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              file ? 'border-green-400 bg-green-50' : dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
            }`}
          >
            {file ? (
              <div>
                <p className="text-2xl mb-1">✅</p>
                <p className="text-sm font-semibold text-green-700">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB · Click to change</p>
              </div>
            ) : (
              <div>
                <p className="text-3xl mb-2">📎</p>
                <p className="text-sm text-gray-500"><span className="text-indigo-600 font-medium">Click to upload</span> or drag & drop</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, JPG, PNG · Max 50MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.docx,.doc,.jpg,.jpeg,.png,.webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Document Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. CDU P&ID Sheet 1 Rev 4"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Linked Event / STO</label>
              <select value={form.event_id} onChange={e => set('event_id', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Organisation Library</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name ?? ev.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Document Number</label>
              <input value={form.document_number} onChange={e => set('document_number', e.target.value)}
                placeholder="e.g. CDU-PID-001"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Revision</label>
              <input value={form.revision} onChange={e => set('revision', e.target.value)}
                placeholder="e.g. 4, A, B"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Equipment Tags (comma-separated)</label>
              <input value={form.equipment_tags} onChange={e => set('equipment_tags', e.target.value)}
                placeholder="e.g. E-301, P-205A, CDU"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={2} placeholder="Brief description of this document..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {file?.type === 'application/pdf' && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
              <span className="text-indigo-500">🤖</span>
              <p className="text-xs text-indigo-700">AI will automatically index this PDF for full-text search after upload</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={upload} disabled={uploading || !file || !form.title}
            className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            {uploading ? <><span className="animate-spin">⟳</span> Uploading…</> : '📤 Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
