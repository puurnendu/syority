'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function OrganizationSettingsPage() {
    const router = useRouter();
    const [org, setOrg] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoError, setLogoError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/settings/organization')
            .then(res => res.json())
            .then(data => {
                setOrg(data);
                setLogoUrl(data?.logoUrl || data?.logo_url || null);
                setLoading(false);
            });
    }, []);

    const handleLogoUpload = async (file: File) => {
        setLogoUploading(true);
        setLogoError(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/settings/organization/logo', {
                method: 'POST',
                body: fd,
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error ?? 'Upload failed');
            setLogoUrl(result.url);
        } catch (err: any) {
            setLogoError(err.message);
        } finally {
            setLogoUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        const form = new FormData(e.currentTarget);

        const body = {
            name: form.get('name'),
            industry: form.get('industry'),
            country: form.get('country'),
            timezone: form.get('timezone'),
            activity_id_increment: form.get('activity_id_increment') != null ? parseInt(String(form.get('activity_id_increment')), 10) : undefined,
        };

        try {
            const res = await fetch('/api/settings/organization', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error('Failed to update organization');
            setMessage({ type: 'success', text: 'Organization settings updated successfully' });
            router.refresh();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
    </div>;

    return (
        <div className="max-w-4xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Organization Settings</h1>
                <p className="text-sm text-gray-500 mt-1">Manage your enterprise profile and global configuration.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {message && (
                    <div className={`p-4 rounded-lg text-sm border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {message.text}
                    </div>
                )}

                <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-sm font-semibold text-gray-900">General Information</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Organization Name</label>
                                <input
                                    name="name"
                                    defaultValue={org?.name}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Industry</label>
                                <input
                                    name="industry"
                                    defaultValue={org?.industry || ''}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Country</label>
                                <input
                                    name="country"
                                    defaultValue={org?.country || ''}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Timezone</label>
                                <select
                                    name="timezone"
                                    defaultValue={org?.timezone || 'UTC'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none bg-white"
                                >
                                    <option value="UTC">UTC (Universal Time)</option>
                                    <option value="Asia/Kolkata">India (IST)</option>
                                    <option value="Asia/Dubai">Dubai (GST)</option>
                                    <option value="Asia/Singapore">Singapore (SGT)</option>
                                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                                    <option value="Europe/London">London (GMT/BST)</option>
                                    <option value="Europe/Paris">Paris (CET/CEST)</option>
                                    <option value="America/New_York">Eastern Time (ET)</option>
                                    <option value="America/Chicago">Central Time (CT)</option>
                                    <option value="America/Denver">Mountain Time (MT)</option>
                                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                    <option value="Australia/Sydney">Sydney (AEST/AEDT)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                    Activity ID Increment Gap
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Gap between auto-generated Activity IDs. Default 3 allows
                                    2 insertions between any two activities (e.g. 001, 004, 007).
                                </p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        name="activity_id_increment"
                                        min={1}
                                        max={10}
                                        defaultValue={org?.activity_id_increment ?? 3}
                                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                    <span className="text-xs text-gray-400">
                                        e.g. gap of 3 → 001, 004, 007, 010...
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Branding ── */}
                <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                        <h2 className="text-sm font-semibold text-gray-900">Branding</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Upload your organisation logo. It will appear in the sidebar and on printed workpack PDFs.</p>
                    </div>
                    <div className="p-6">
                        <div className="flex items-start gap-6">

                            {/* Logo preview box */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-32 h-32 bg-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors flex-shrink-0 overflow-hidden group"
                                title="Click to upload logo"
                            >
                                {logoUploading ? (
                                    <span className="text-blue-500 text-sm animate-pulse">Uploading…</span>
                                ) : logoUrl ? (
                                    <img
                                        src={logoUrl}
                                        alt="Organisation logo"
                                        className="w-full h-full object-contain p-2"
                                    />
                                ) : (
                                    <div className="text-center">
                                        <span className="text-3xl text-gray-300 group-hover:text-blue-400 transition-colors">🖼️</span>
                                        <p className="text-[10px] text-gray-400 mt-1">Click to upload</p>
                                    </div>
                                )}
                            </div>

                            {/* Instructions + drag-drop zone */}
                            <div className="flex-1">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        const file = e.dataTransfer.files[0];
                                        if (file) handleLogoUpload(file);
                                    }}
                                    className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                                >
                                    {logoUploading ? (
                                        <p className="text-sm text-blue-600 font-medium">
                                            <span className="animate-spin inline-block mr-2">⟳</span>
                                            Uploading your logo…
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-gray-600">
                                                <span className="text-blue-600 font-semibold">Click to browse</span>
                                                {' '}or drag and drop
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG or WEBP · Max 2 MB · Recommended 400×400 px</p>
                                        </>
                                    )}
                                </div>

                                {/* Error message */}
                                {logoError && (
                                    <p className="mt-2 text-xs text-red-600 font-medium">⚠ {logoError}</p>
                                )}

                                {/* Success message */}
                                {logoUrl && !logoUploading && !logoError && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-xs text-green-600 font-medium">✓ Logo uploaded successfully</span>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-xs text-blue-500 hover:text-blue-700 underline"
                                        >
                                            Replace
                                        </button>
                                    </div>
                                )}

                                <p className="text-[11px] text-gray-400 mt-3">
                                    Logo is saved immediately on upload — no need to click "Save Changes".
                                </p>
                            </div>
                        </div>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                            className="hidden"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleLogoUpload(file);
                                // Reset input so same file can be re-selected
                                e.target.value = '';
                            }}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200/50 transition-all disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
