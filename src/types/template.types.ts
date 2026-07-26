/** Shared types for workpack template and template activity editing. */

export type UdfDefault = {
  code: string;
  value: string;
};

export type TemplateActivityForm = {
  id?: string;
  sequence_number: number;
  activity_code: string;
  activity_code_library_id: string | null;
  description: string;
  duration_hours: number | null;
  is_optional: boolean;
  udf_defaults: Record<string, string>;
  predecessor_sequences: number[];
  _codeDescription?: string;
  _disciplineName?: string;
};

export type TemplateChecklistItemForm = {
  id?: string;
  checklist_type: 'dropping' | 'boxup';
  sequence_number: number;
  description: string;
  responsible_party: string;
  is_mandatory: boolean;
};

export type TemplateForm = {
  name: string;
  equipment_type: string;
  job_type: string;
  description: string;
  activities: TemplateActivityForm[];
  dropping_items: TemplateChecklistItemForm[];
  boxup_items: TemplateChecklistItemForm[];
}
