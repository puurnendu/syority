/**
 * Primavera P6 XER parser.
 *
 * Parses tab-delimited XER text format, extracting TASK and TASKPRED tables.
 */

export interface ParsedActivity {
  external_id: string;           // Task/UID
  activity_code: string;         // Task/ID
  name: string;
  duration: number;              // working days
  planned_start: Date | null;
  planned_end: Date | null;
  percent_complete: number;      // 0–100
  budgeted_cost: number | null;
  constraint_type: string | null;
  constraint_date: Date | null;
  wbs_code: string;              
  is_milestone: boolean;
}

export interface ParsedRelationship {
  predecessor_external_id: string;
  successor_external_id: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number; // working days
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseType(typeStr: string): 'FS' | 'SS' | 'FF' | 'SF' {
  if (typeStr === 'PR_SS') return 'SS';
  if (typeStr === 'PR_FF') return 'FF';
  if (typeStr === 'PR_SF') return 'SF';
  return 'FS'; // Default for 'PR_FS' or others
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function parseP6Xer(
  xerString: string,
  _projectId: string,
  _organizationId: string,
  _workpackId?: string,
  hoursPerDay = 10
): Promise<{ activities: ParsedActivity[]; relationships: ParsedRelationship[] }> {
  const activities: ParsedActivity[] = [];
  const relationships: ParsedRelationship[] = [];

  const lines = xerString.split(/\r?\n/);
  
  let currentTable = '';
  let fields: string[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    
    // XER uses tab delimiters
    const parts = line.split('\t');
    const type = parts[0];

    if (type === '%T') {
      currentTable = parts[1];
      fields = [];
    } else if (type === '%F') {
      fields = parts.slice(1);
    } else if (type === '%R') {
      const values = parts.slice(1);
      const record: Record<string, string> = {};
      for (let i = 0; i < fields.length; i++) {
        record[fields[i]] = values[i];
      }

      if (currentTable === 'TASK') {
        const taskType = record['task_type'];
        if (taskType === 'TT_LOE' || taskType === 'TT_WBS') continue;

        const durHr = parseFloat(record['target_drtn_hr_cnt'] || record['target_work_qty'] || '0');
        const pct = parseFloat(record['phys_complete_pct'] || '0');

        activities.push({
          external_id: record['task_id'] || '',
          activity_code: record['task_code'] || '',
          name: record['task_name'] || '',
          duration: isNaN(durHr) ? 0 : durHr / hoursPerDay,
          planned_start: parseDate(record['target_start_date']),
          planned_end: parseDate(record['target_end_date']),
          percent_complete: Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct)),
          budgeted_cost: null,
          constraint_type: null,
          constraint_date: null,
          wbs_code: record['wbs_id'] || '',
          is_milestone: taskType === 'TT_Mile',
        });
      } else if (currentTable === 'TASKPRED') {
        const lagHr = parseFloat(record['lag_hr_cnt'] || '0');

        relationships.push({
          predecessor_external_id: record['pred_task_id'] || '',
          successor_external_id: record['task_id'] || '',
          type: parseType(record['pred_type']),
          lag: isNaN(lagHr) ? 0 : lagHr / hoursPerDay,
        });
      }
    }
  }

  return { activities, relationships };
}
