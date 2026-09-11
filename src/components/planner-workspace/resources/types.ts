export interface ShiftDefinition {
  id: string;
  event_id: string;
  name: string;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  description?: string | null;
}

export interface ResourceCapacity {
  id: string;
  event_id: string;
  resource_type_id: string;
  contractor_id: string | null;
  shift_id: string | null;
  target_date: string | null; // ISO Date String
  capacity_limit: number; // Decimal mapped to number
  notes?: string | null;
  resource_type?: { name: string };
  contractor?: { name: string };
  shift?: { name: string };
}

export interface ResourceLoadingResult {
  date: string;
  shift: string | null;
  resource_type_id: string;
  resource_type_name: string;
  contractor_id: string | null;
  planned_demand: number;
  available_capacity: number;
  variance: number;
  utilization_percent: number | null;
  is_over_allocated: boolean;
}

export interface ResourceTypeSummary {
  id: string;
  name: string;
}

export interface ContractorSummary {
  id: string;
  name: string;
}
