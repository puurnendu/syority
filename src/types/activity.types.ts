/**
 * Shared types for workpack activity (row) and related structures.
 */

export type ActivityResourceRow = {
    id?: string;
    resource_type: 'labor' | 'material' | 'machine';
    resource_name: string;
    quantity: number;
    unit: string;
    crew_size?: number;
};

export type PredecessorLink = {
    activity_id: string;
    sequence_number: number;
    description: string;
    relationship_type: 'FS' | 'SS' | 'FF' | 'SF';
    lag_hours: number;
};

export type QaClearance = {
    id?: string;
    cleared_by?: string;
    cleared_at?: string;
    certificate_number?: string;
    witness_name?: string;
    notes?: string;
};

export type ActivityRow = {
    id: string;
    sequence_number: number;
    activity_code: string | null;
    description: string;
    duration_hours: number | null;
    planned_start: Date | null;
    planned_end: Date | null;
    actual_start: Date | null;
    actual_end: Date | null;
    progress_percent: number;
    status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
    is_optional: boolean;
    notes: string | null;
    predecessor_ids: string[];
    udf_values: Record<string, string>;
    resources: ActivityResourceRow[];
    discipline_name?: string;
    hold_point_type?: string;
    qa_witness_party?: string;
    qa_clearances?: QaClearance[];
};
