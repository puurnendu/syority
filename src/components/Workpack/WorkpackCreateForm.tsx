'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    FiSave,
    FiX,
    FiFileText,
    FiCalendar,
    FiClock,
    FiAlertCircle,
    FiSettings,
    FiUser,
    FiUpload,
    FiZap
} from 'react-icons/fi';

interface Site {
    id: string;
    name: string;
    code: string;
}

interface Discipline {
    id: string;
    name: string;
    code: string;
}

interface EventOption {
    id: string;
    code: string;
    name: string;
    status: string;
}
interface HierarchyUnit {
    id: string;
    name: string;
    code: string;
    systems: { id: string; name: string; code: string; assets: { id: string; tag_number: string; name: string; asset_type: string | null }[] }[];
}
interface HierarchyPlant {
    id: string;
    name: string;
    code: string;
    units: HierarchyUnit[];
}
interface ScopeNozzle {
    id: string;
    designation: string;
    service: string | null;
    joint_master: { id: string; joint_number: string } | null;
}
interface ScopeLine {
    id: string;
    line_number: string;
    total_joint_count: number;
    joints: { id: string; joint_number: string }[];
}
interface WorkpackCreateFormProps {
    sites: Site[];
    disciplines: Discipline[];
    initialProjectId?: string;
}

export function WorkpackCreateForm({ sites, disciplines, initialProjectId }: WorkpackCreateFormProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        site_id: sites[0]?.id ?? '',
        workpack_number: '',
        title: '',
        unit_code: '',
        sap_work_order: '',
        sap_notification: '',
        discipline_id: '',
        work_type: 'Shutdown',
        priority: 'medium',
        scope_of_work: '',
        planned_start_date: '',
        planned_end_date: '',
        estimated_manhours: '',
        project_id: initialProjectId ?? ''
    });

    const [idPreview, setIdPreview] = useState('');
    const [idPreviewLoading, setIdPreviewLoading] = useState(false);

    const [suggestedWorkpackNumber, setSuggestedWorkpackNumber] = useState('');

    useEffect(() => {
        fetch('/api/workpacks/next-number')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d?.suggested) setSuggestedWorkpackNumber(String(d.suggested));
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const code = disciplines.find((d) => d.id === formData.discipline_id)?.code ?? '';
        if (!formData.unit_code.trim() || !code) {
            setIdPreview('');
            return;
        }
        setIdPreviewLoading(true);
        const params = new URLSearchParams({
            unit_code: formData.unit_code.trim(),
            discipline_code: code,
        });
        fetch(`/api/workpacks/preview-id?${params}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (d?.preview) setIdPreview(d.preview);
            })
            .catch(() => {})
            .finally(() => setIdPreviewLoading(false));
    }, [formData.unit_code, formData.discipline_id, disciplines]);

    const [events, setEvents] = useState<EventOption[]>([]);
    const [hierarchy, setHierarchy] = useState<HierarchyPlant[]>([]);
    const [eventId, setEventId] = useState('');
    const [plantId, setPlantId] = useState('');
    const [unitId, setUnitId] = useState('');
    const [systemId, setSystemId] = useState('');
    const [assetId, setAssetId] = useState('');
    const [scopeData, setScopeData] = useState<{ nozzles: ScopeNozzle[]; line_lists: ScopeLine[] } | null>(null);
    const [selectedJointMasterIds, setSelectedJointMasterIds] = useState<Set<string>>(new Set());
    const [scopeLoading, setScopeLoading] = useState(false);
    const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);
    const [equipmentType, setEquipmentType] = useState('');
    const [otherEquipmentType, setOtherEquipmentType] = useState('');
    const [gadFile, setGadFile] = useState<File | undefined>();
    const [equipmentDrawingFile, setEquipmentDrawingFile] = useState<File | undefined>();
    const [riggingPlanFile, setRiggingPlanFile] = useState<File | undefined>();
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [isAiGenerating, setIsAiGenerating] = useState(false);

    useEffect(() => {
        fetch('/api/certificate-templates')
            .then((r) => (r.ok ? r.json() : []))
            .then((templates: any[]) => {
                const all = templates.flatMap((t: any) => t.equipment_types ?? []);
                setEquipmentTypes([...new Set(all)].sort());
            })
            .catch(() => {});
    }, []);

    const siteId = formData.site_id;
    useEffect(() => {
        if (!siteId) {
            setEvents([]);
            setHierarchy([]);
            setEventId('');
            setPlantId('');
            setUnitId('');
            setSystemId('');
            setAssetId('');
            setScopeData(null);
            setSelectedJointMasterIds(new Set());
            return;
        }
        Promise.all([
            fetch(`/api/events?site_id=${encodeURIComponent(siteId)}`).then((r) => (r.ok ? r.json() : { data: [] })).then((d) => d.data ?? []),
            fetch(`/api/hierarchy?site_id=${encodeURIComponent(siteId)}`).then((r) => (r.ok ? r.json() : { plants: [] })).then((d) => d.plants ?? []),
        ]).then(([evts, plants]) => {
            setEvents(evts);
            setHierarchy(plants);
            setEventId('');
            setPlantId('');
            setUnitId('');
            setSystemId('');
            setAssetId('');
            setScopeData(null);
            setSelectedJointMasterIds(new Set());
        });
    }, [siteId]);

    useEffect(() => {
        if (!assetId) {
            setScopeData(null);
            setSelectedJointMasterIds(new Set());
            return;
        }
        setScopeLoading(true);
        fetch(`/api/hierarchy/asset/${encodeURIComponent(assetId)}/scope`)
            .then((r) => (r.ok ? r.json() : {}))
            .then((d: { nozzles?: ScopeNozzle[]; line_lists?: ScopeLine[] }) => {
                setScopeData({ nozzles: d.nozzles ?? [], line_lists: d.line_lists ?? [] });
                setSelectedJointMasterIds(new Set());
            })
            .catch(() => setScopeData(null))
            .finally(() => setScopeLoading(false));
    }, [assetId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.unit_code.trim()) {
            setError('Unit / Area Code is required');
            return;
        }
        if (!formData.discipline_id) {
            setError('Primary Discipline is required');
            return;
        }
        setIsSubmitting(true);
        setError(null);

        const primary_discipline = disciplines.find((d) => d.id === formData.discipline_id)?.code ?? '';
        try {
            const res = await fetch('/api/workpacks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    workpack_number: formData.workpack_number?.trim() || (suggestedWorkpackNumber || undefined),
                    unit_code: formData.unit_code.trim() || undefined,
                    primary_discipline: primary_discipline || undefined,
                    equipment_type: equipmentType && equipmentType !== '__other' ? equipmentType : (otherEquipmentType?.trim() || undefined),
                    planned_start_date: formData.planned_start_date ? new Date(formData.planned_start_date) : null,
                    planned_end_date: formData.planned_end_date ? new Date(formData.planned_end_date) : null,
                    estimated_manhours: formData.estimated_manhours ? parseFloat(formData.estimated_manhours) : 0,
                    status: 'draft',
                    event_id: eventId || undefined,
                    plant_id: plantId || undefined,
                    unit_id: unitId || undefined,
                    system_id: systemId || undefined,
                    asset_id: assetId || undefined,
                    project_id: formData.project_id || undefined,
                    selected_joint_master_ids: Array.from(selectedJointMasterIds),
                }),
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'Failed to create workpack');
            }

            router.push(`/workpacks/${result.data.id}`);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    const handleAiGenerate = async () => {
        setError(null);
        if (!formData.title?.trim()) {
            setError('Workpack Title is required for AI generation.');
            return;
        }
        if (!formData.site_id) {
            setError('Site Location is required for AI generation.');
            return;
        }
        setIsAiGenerating(true);
        try {
            const form = new FormData();
            form.append('title', formData.title);
            form.append('site_id', formData.site_id);
            form.append('sap_work_order', formData.sap_work_order);
            form.append('sap_notification', formData.sap_notification);
            form.append('discipline_id', formData.discipline_id);
            form.append('work_type', formData.work_type);
            form.append('priority', formData.priority);
            form.append('scope_of_work', formData.scope_of_work);
            form.append('planned_start_date', formData.planned_start_date);
            form.append('planned_end_date', formData.planned_end_date);
            form.append('estimated_manhours', formData.estimated_manhours);
            if (gadFile) form.append('gadFile', gadFile);
            if (equipmentDrawingFile) form.append('equipmentDrawingFile', equipmentDrawingFile);
            if (riggingPlanFile) form.append('riggingPlanFile', riggingPlanFile);
            additionalFiles.forEach((f, i) => form.append('additionalFiles', f));
            const res = await fetch('/api/workpacks/ai-generate', { method: 'POST', body: form });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'AI generation failed');
            if (result.redirect) {
                router.push(result.redirect);
                router.refresh();
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsAiGenerating(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto space-y-6 pb-12">
            {/* Header Area */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Create New Workpack</h1>
                    <p className="text-sm text-gray-500 mt-1">Fill in the details below to initialize a new workpack document.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                        <FiX className="w-4 h-4" />
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleAiGenerate}
                        disabled={isSubmitting || isAiGenerating}
                        className="px-5 py-2 text-sm font-medium text-amber-800 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isAiGenerating ? (
                            <span className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                        ) : (
                            <FiZap className="w-4 h-4" />
                        )}
                        {isAiGenerating ? 'AI is generating structured workpack...' : 'Generate with AI'}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || isAiGenerating}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                        {isSubmitting ? (
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave className="w-4 h-4" />
                        )}
                        {isSubmitting ? 'Creating...' : 'Create Workpack'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm">
                    <FiAlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <p>{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Core Info */}
                <div className="md:col-span-2 space-y-6">
                    {/* General Section */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <FiFileText className="text-blue-600" />
                            <h2 className="font-semibold text-gray-800">General Information</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Workpack Number</label>
                                <input
                                    type="text"
                                    name="workpack_number"
                                    value={formData.workpack_number}
                                    onChange={handleChange}
                                    placeholder={suggestedWorkpackNumber ? `Suggested: ${suggestedWorkpackNumber}` : 'e.g. WP-2026-000124'}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                                />
                                <p className="text-xs text-gray-400 mt-1">Optional. If left blank, SYORITY will use the suggested next number.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Workpack Title *</label>
                                <input
                                    required
                                    type="text"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleChange}
                                    placeholder="e.g. Heat Exchanger E-1012A Bundle Replacement"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit / Area Code <span className="text-red-500 ml-0.5">*</span></label>
                                    <input
                                        type="text"
                                        value={formData.unit_code}
                                        onChange={(e) => setFormData((prev) => ({ ...prev, unit_code: e.target.value.toUpperCase().slice(0, 6) }))}
                                        placeholder="FCC"
                                        maxLength={6}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono tracking-wider"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">3–6 chars, e.g. FCC, ARU, CDU, HDS</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Discipline <span className="text-red-500 ml-0.5">*</span></label>
                                    <select
                                        name="discipline_id"
                                        value={formData.discipline_id}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                    >
                                        <option value="">Select discipline...</option>
                                        {disciplines.map((d) => (
                                            <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Equipment Type
                                    <span className="text-gray-400 text-xs font-normal ml-1">(optional — auto-attaches certificates)</span>
                                </label>
                                <select
                                    value={equipmentType}
                                    onChange={(e) => setEquipmentType(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                >
                                    <option value="">Select equipment type...</option>
                                    {equipmentTypes.map((et) => (
                                        <option key={et} value={et}>{et}</option>
                                    ))}
                                    <option value="__other">Other (type below)</option>
                                </select>
                                {equipmentType === '__other' && (
                                    <input
                                        type="text"
                                        placeholder="Enter equipment type..."
                                        value={otherEquipmentType}
                                        onChange={(e) => setOtherEquipmentType(e.target.value)}
                                        className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Workpack ID</label>
                                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors ${idPreview ? 'border-blue-300 bg-blue-50' : 'border-dashed border-gray-200 bg-gray-50'}`}>
                                    {idPreviewLoading ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <div className="animate-spin w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                                            Generating...
                                        </div>
                                    ) : idPreview ? (
                                        <>
                                            <span className="font-mono text-xl font-bold text-[#0D2137] tracking-wider">{idPreview}</span>
                                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">auto-generated on save</span>
                                        </>
                                    ) : (
                                        <span className="text-sm text-gray-400 italic">Enter Unit Code and Discipline to preview ID</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-400 mt-1">Format: UNIT-DISC-NNN · Unique within organisation · Cannot be changed after creation</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700 flex items-start gap-2">
                                <span className="mt-0.5">ℹ️</span>
                                <span>SAP Work Order number can be assigned by a platform administrator after the workpack is created.</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SAP Work Order</label>
                                    <input
                                        type="text"
                                        name="sap_work_order"
                                        value={formData.sap_work_order}
                                        onChange={handleChange}
                                        placeholder="WO-XXXXXX"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">SAP Notification</label>
                                    <input
                                        type="text"
                                        name="sap_notification"
                                        value={formData.sap_notification}
                                        onChange={handleChange}
                                        placeholder="NOT-XXXXXX"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Scope of Work</label>
                                <textarea
                                    name="scope_of_work"
                                    value={formData.scope_of_work}
                                    onChange={handleChange}
                                    rows={6}
                                    placeholder="Enter detailed scope of work, technical requirements, and objectives..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Planning Section */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <FiCalendar className="text-green-600" />
                            <h2 className="font-semibold text-gray-800">Operational Planning</h2>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start Date</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="planned_start_date"
                                        value={formData.planned_start_date}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Planned End Date</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        name="planned_end_date"
                                        value={formData.planned_end_date}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Manhours</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="estimated_manhours"
                                        value={formData.estimated_manhours}
                                        onChange={handleChange}
                                        placeholder="0"
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                    <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Technical Documents */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <FiUpload className="text-amber-600" />
                            <h2 className="font-semibold text-gray-800">Technical Documents</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GAD Drawing (PDF)</label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => setGadFile(e.target.files?.[0])}
                                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-800 file:font-medium"
                                />
                                {gadFile && <p className="mt-1 text-xs text-gray-500">{gadFile.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Drawing (PDF)</label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => setEquipmentDrawingFile(e.target.files?.[0])}
                                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-800 file:font-medium"
                                />
                                {equipmentDrawingFile && <p className="mt-1 text-xs text-gray-500">{equipmentDrawingFile.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rigging Plan (PDF)</label>
                                <input
                                    type="file"
                                    accept=".pdf,application/pdf"
                                    onChange={(e) => setRiggingPlanFile(e.target.files?.[0])}
                                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-800 file:font-medium"
                                />
                                {riggingPlanFile && <p className="mt-1 text-xs text-gray-500">{riggingPlanFile.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Additional Documents
                                    <span className="text-gray-400 font-normal ml-1">(add from multiple folders)</span>
                                </label>

                                {/* File list */}
                                {additionalFiles.length > 0 && (
                                    <div className="mb-2 space-y-1.5">
                                        {additionalFiles.map((file, idx) => (
                                            <div
                                                key={`${file.name}-${idx}`}
                                                className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg"
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FiFileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                                        {file.size < 1024 * 1024
                                                            ? `${(file.size / 1024).toFixed(0)} KB`
                                                            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setAdditionalFiles((prev) =>
                                                            prev.filter((_, i) => i !== idx)
                                                        )
                                                    }
                                                    className="ml-2 flex-shrink-0 w-5 h-5 flex items-center justify-center
                                                               rounded-full text-gray-400 hover:text-red-500
                                                               hover:bg-red-50 transition-colors"
                                                    title="Remove file"
                                                >
                                                    <FiX className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add more files button */}
                                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm
                                                  font-medium text-amber-800 bg-amber-50 border border-amber-200
                                                  rounded-lg hover:bg-amber-100 transition-colors">
                                    <FiUpload className="w-4 h-4" />
                                    {additionalFiles.length === 0 ? 'Choose Files' : '+ Add More Files'}
                                    <input
                                        type="file"
                                        multiple
                                        accept=".pdf,application/pdf"
                                        className="hidden"
                                        onChange={(e) => {
                                            const newFiles = Array.from(e.target.files ?? []);
                                            if (newFiles.length === 0) return;
                                            setAdditionalFiles((prev) => {
                                                const existingNames = new Set(prev.map((f) => f.name));
                                                const unique = newFiles.filter((f) => !existingNames.has(f.name));
                                                return [...prev, ...unique];
                                            });
                                            // Reset input so same file can be re-added after deletion
                                            e.target.value = '';
                                        }}
                                    />
                                </label>

                                {additionalFiles.length > 0 && (
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-gray-400">
                                            {additionalFiles.length} file{additionalFiles.length !== 1 ? 's' : ''} selected
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setAdditionalFiles([])}
                                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Settings & Metadata */}
                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <FiSettings className="text-gray-600" />
                            <h2 className="font-semibold text-gray-800">Operational Context</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Site Location *</label>
                                <select
                                    required
                                    name="site_id"
                                    value={formData.site_id}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                >
                                    {sites.map(site => (
                                        <option key={site.id} value={site.id}>{site.name} ({site.code})</option>
                                    ))}
                                </select>
                            </div>
                            {siteId && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Event (optional)</label>
                                        <select
                                            value={eventId}
                                            onChange={(e) => setEventId(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">None</option>
                                            {events.map((ev) => (
                                                <option key={ev.id} value={ev.id}>{ev.code} — {ev.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Plant</label>
                                        <select
                                            value={plantId}
                                            onChange={(e) => { setPlantId(e.target.value); setUnitId(''); setSystemId(''); setAssetId(''); }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">Select plant...</option>
                                            {hierarchy.map((p) => (
                                                <option key={p.id} value={p.id}>{p.code ?? p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                                        <select
                                            value={unitId}
                                            onChange={(e) => { setUnitId(e.target.value); setSystemId(''); setAssetId(''); }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">Select unit...</option>
                                            {hierarchy.find((p) => p.id === plantId)?.units.map((u) => (
                                                <option key={u.id} value={u.id}>{u.code ?? u.name}</option>
                                            )) ?? []}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">System</label>
                                        <select
                                            value={systemId}
                                            onChange={(e) => { setSystemId(e.target.value); setAssetId(''); }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">Select system...</option>
                                            {hierarchy.find((p) => p.id === plantId)?.units.find((u) => u.id === unitId)?.systems.map((s) => (
                                                <option key={s.id} value={s.id}>{s.code ?? s.name}</option>
                                            )) ?? []}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
                                        <select
                                            value={assetId}
                                            onChange={(e) => setAssetId(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                        >
                                            <option value="">Select asset...</option>
                                            {hierarchy.find((p) => p.id === plantId)?.units.find((u) => u.id === unitId)?.systems.find((s) => s.id === systemId)?.assets.map((a) => (
                                                <option key={a.id} value={a.id}>{a.tag_number} — {a.name}</option>
                                            )) ?? []}
                                        </select>
                                    </div>
                                </>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Lead Discipline</label>
                                <select
                                    name="discipline_id"
                                    value={formData.discipline_id}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white appearance-none cursor-pointer"
                                    aria-label="Select lead discipline"
                                >
                                    <option value="">Select discipline</option>
                                    {disciplines.map(d => (
                                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Work Type</label>
                                <select
                                    name="work_type"
                                    value={formData.work_type}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                >
                                    <option value="Shutdown">Shutdown (STO)</option>
                                    <option value="Maintenance">Maintenance (PM)</option>
                                    <option value="Project">Capital Project</option>
                                    <option value="Emergency">Emergency Work</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <select
                                    name="priority"
                                    value={formData.priority}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="critical">Critical</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {scopeLoading && (
                        <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-3 text-gray-500">
                            <div className="animate-spin w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full" />
                            Loading scope…
                        </div>
                    )}
                    {!scopeLoading && scopeData && (scopeData.nozzles.length > 0 || scopeData.line_lists.length > 0) && (
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                                <FiSettings className="text-green-600" />
                                <h2 className="font-semibold text-gray-800">Scope — Joints</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {scopeData.nozzles.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">Nozzle joints</p>
                                        <div className="space-y-2">
                                            {scopeData.nozzles.map((n) => (
                                                n.joint_master ? (
                                                    <label key={n.id} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedJointMasterIds.has(n.joint_master!.id)}
                                                            onChange={(e) => {
                                                                const next = new Set(selectedJointMasterIds);
                                                                if (e.target.checked) next.add(n.joint_master!.id);
                                                                else next.delete(n.joint_master!.id);
                                                                setSelectedJointMasterIds(next);
                                                            }}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm">{n.designation}{n.service ? ` — ${n.service}` : ''} ({n.joint_master.joint_number})</span>
                                                    </label>
                                                ) : (
                                                    <span key={n.id} className="text-sm text-gray-400 ml-6">{n.designation} — no joint master</span>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {scopeData.line_lists.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">Connected lines</p>
                                        <div className="space-y-2">
                                            {scopeData.line_lists.map((line) => (
                                                <div key={line.id}>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={line.joints.length > 0 && line.joints.every((j) => selectedJointMasterIds.has(j.id))}
                                                            onChange={(e) => {
                                                                const next = new Set(selectedJointMasterIds);
                                                                line.joints.forEach((j) => (e.target.checked ? next.add(j.id) : next.delete(j.id)));
                                                                setSelectedJointMasterIds(next);
                                                            }}
                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-sm font-mono">{line.line_number}</span>
                                                        <span className="text-xs text-gray-500">({line.joints.length} joints)</span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                            <FiUser className="text-blue-600 w-5 h-5 mt-0.5" />
                            <div>
                                <h3 className="font-semibold text-blue-900 text-sm">Role-Based Creation</h3>
                                <p className="text-blue-700 text-xs mt-1 leading-relaxed">
                                    You are creating this workpack as a **Workpack Manager**. The ID will be automatically generated based on the organization settings upon submission.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    );
}
