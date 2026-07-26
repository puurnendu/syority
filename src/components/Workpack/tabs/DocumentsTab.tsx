'use client';

import { useState, useEffect, useRef } from 'react';

type WorkpackDoc = {
    id: string;
    title: string;
    original_filename: string;
    document_type: string;
    mime_type: string;
    file_size_bytes: number | null;
    source: string;
    include_in_pdf: boolean;
    description?: string | null;
    created_at: string;
};

const DOC_TYPE_OPTIONS = [
    { value: 'drawing',       label: '📐 Drawing' },
    { value: 'datasheet',     label: '📋 Datasheet' },
    { value: 'procedure',     label: '📄 Procedure' },
    { value: 'inspection',    label: '🔍 Inspection Report' },
    { value: 'certificate',   label: '📜 Certificate' },
    { value: 'specification', label: '📎 Specification' },
    { value: 'attachment',    label: '📁 Attachment' },
];

const MIME_ICON: Record<string, string> = {
    'application/pdf':                                                                    '📄',
    'image/png':                                                                          '🖼',
    'image/jpeg':                                                                         '🖼',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':                  '📊',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':            '📝',
};

function formatBytes(bytes: number | null): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsTabProps {
    workpackId: string;
    canEdit?: boolean;
}

export function DocumentsTab({ workpackId, canEdit = true }: DocumentsTabProps) {
    const [docs, setDocs] = useState<WorkpackDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadSuccess, setUploadSuccess] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editType, setEditType] = useState('attachment');
    const [editDesc, setEditDesc] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Upload form state
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadType, setUploadType] = useState('attachment');
    const [showUploadForm, setShowUploadForm] = useState(false);

    const load = async () => {
        try {
            const res = await fetch(`/api/workpacks/${workpackId}/documents`);
            if (res.ok) {
                const data = await res.json();
                setDocs(Array.isArray(data) ? data : []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workpackId]);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        const file = fileInputRef.current?.files?.[0];
        if (!file) { setUploadError('Please select a file.'); return; }

        setUploading(true);
        setUploadError('');
        setUploadSuccess('');

        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('title', uploadTitle || file.name);
            fd.append('document_type', uploadType);

            const res = await fetch(`/api/workpacks/${workpackId}/documents`, {
                method: 'POST',
                body: fd,
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Upload failed (${res.status})`);
            }

            setUploadSuccess(`✓ "${uploadTitle || file.name}" uploaded successfully.`);
            setUploadTitle('');
            setUploadType('attachment');
            if (fileInputRef.current) fileInputRef.current.value = '';
            setShowUploadForm(false);
            await load();
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId: string, filename: string) => {
        if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
        setDeletingId(docId);
        try {
            await fetch(`/api/workpacks/${workpackId}/documents/${docId}`, { method: 'DELETE' });
            await load();
        } finally {
            setDeletingId(null);
        }
    };

    const startEdit = (doc: WorkpackDoc) => {
        setEditingId(doc.id);
        setEditTitle(doc.title);
        setEditType(doc.document_type);
        setEditDesc(doc.description ?? '');
    };

    const saveEdit = async (docId: string) => {
        await fetch(`/api/workpacks/${workpackId}/documents/${docId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: editTitle, document_type: editType, description: editDesc }),
        });
        setEditingId(null);
        await load();
    };

    const toggleIncludeInPdf = async (doc: WorkpackDoc) => {
        await fetch(`/api/workpacks/${workpackId}/documents/${doc.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ include_in_pdf: !doc.include_in_pdf }),
        });
        await load();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading documents…
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        📁 Uploaded Documents
                        <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {docs.length} file{docs.length !== 1 ? 's' : ''}
                        </span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Drawing files, datasheets, procedures and references attached to this workpack.
                    </p>
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => { setShowUploadForm((v) => !v); setUploadError(''); setUploadSuccess(''); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        ⬆ Upload Document
                    </button>
                )}
            </div>

            {/* Success/error banners */}
            {uploadSuccess && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    {uploadSuccess}
                    <button onClick={() => setUploadSuccess('')} className="ml-auto text-green-400 hover:text-green-600">✕</button>
                </div>
            )}

            {/* Upload form */}
            {showUploadForm && canEdit && (
                <form
                    onSubmit={handleUpload}
                    className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-4"
                >
                    <p className="text-sm font-semibold text-blue-900">Upload a new document</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Title <span className="text-gray-400">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={uploadTitle}
                                onChange={(e) => setUploadTitle(e.target.value)}
                                placeholder="e.g. T-435 GA Drawing Rev. 3"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Document type</label>
                            <select
                                value={uploadType}
                                onChange={(e) => setUploadType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                            >
                                {DOC_TYPE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                            File <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx"
                            required
                            className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white file:text-blue-700 file:border file:border-blue-200 hover:file:bg-blue-50 cursor-pointer"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Accepted: PDF, PNG, JPEG, XLSX, DOCX · Max 50 MB</p>
                    </div>

                    {uploadError && (
                        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {uploadError}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            disabled={uploading}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Uploading…
                                </>
                            ) : '⬆ Upload'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowUploadForm(false); setUploadError(''); }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Documents list */}
            {docs.length === 0 ? (
                <div className="py-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center bg-gray-50">
                    <span className="text-5xl mb-4 opacity-20">📁</span>
                    <p className="text-sm font-medium text-gray-400">No documents uploaded yet</p>
                    <p className="text-xs text-gray-300 mt-1">Upload drawings, datasheets or procedures using the button above.</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">In PDF</th>
                                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {docs.map((doc) => (
                                <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-4 py-3">
                                        {editingId === doc.id ? (
                                            <div className="space-y-2">
                                                <input
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                                                />
                                                <input
                                                    value={editDesc}
                                                    onChange={(e) => setEditDesc(e.target.value)}
                                                    placeholder="Description (optional)"
                                                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-300 outline-none text-gray-600"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-2.5">
                                                <span className="text-xl mt-0.5 flex-none">
                                                    {MIME_ICON[doc.mime_type] ?? '📎'}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                                                    {doc.title !== doc.original_filename && (
                                                        <p className="text-xs text-gray-400 truncate">{doc.original_filename}</p>
                                                    )}
                                                    {doc.description && (
                                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{doc.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {editingId === doc.id ? (
                                            <select
                                                value={editType}
                                                onChange={(e) => setEditType(e.target.value)}
                                                className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-300 outline-none"
                                            >
                                                {DOC_TYPE_OPTIONS.map((o) => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                                                {doc.document_type.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                                        {formatBytes(doc.file_size_bytes)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                            doc.source === 'ai'
                                                ? 'bg-violet-100 text-violet-700'
                                                : 'bg-gray-100 text-gray-500'
                                        }`}>
                                            {doc.source === 'ai' ? '🤖 AI' : '👤 Manual'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            type="button"
                                            onClick={() => toggleIncludeInPdf(doc)}
                                            title={doc.include_in_pdf ? 'Included in workpack PDF' : 'Excluded from workpack PDF — click to include'}
                                            className={`w-7 h-7 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
                                                doc.include_in_pdf
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : 'bg-white border-gray-200 text-gray-300 hover:border-green-400'
                                            }`}
                                        >
                                            {doc.include_in_pdf ? '✓' : ''}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {editingId === doc.id ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => saveEdit(doc.id)}
                                                    className="text-xs px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingId(null)}
                                                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <a
                                                    href={`/api/workpacks/${workpackId}/documents/${doc.id}`}
                                                    download={doc.original_filename}
                                                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                                    title="Download file"
                                                >
                                                    ⬇
                                                </a>
                                                {canEdit && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => startEdit(doc)}
                                                            className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                                            title="Edit title / type"
                                                        >
                                                            ✏
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelete(doc.id, doc.original_filename)}
                                                            disabled={deletingId === doc.id}
                                                            className="text-xs px-2.5 py-1 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                                            title="Delete document"
                                                        >
                                                            {deletingId === doc.id ? '…' : '🗑'}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="px-4 py-3 border-t border-gray-50 bg-gray-50 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                            Toggle <strong>In PDF</strong> to include a document in the exported workpack PDF.
                        </p>
                        <p className="text-xs text-gray-400">
                            {docs.filter((d) => d.include_in_pdf).length} of {docs.length} included in PDF
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
