/**
 * Primavera P6 XER-lite formatter.
 *
 * Generates a tab-delimited XER file containing:
 *   %T ERMHDR  — header block
 *   %T PROJECT — one project row
 *   %T TASK    — one row per activity
 *   %T TASKPRED— one row per relationship
 *   %E EOF marker
 *
 * This is a read-compatible "XER-lite" — P6 can import it.
 * Fields not provided are left blank.
 */

export interface P6Activity {
  id: string;
  activity_code: string | null;
  description: string;
  planned_start: Date | null;
  planned_end: Date | null;
  duration_hours: number;
  percent_complete: number;
  wbs_code: string | null;
  is_milestone: boolean;
}

export interface P6Relationship {
  predecessor_activity_code: string;
  successor_activity_code: string;
  relationship_type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
}

export interface P6Project {
  id: string;
  name: string;
  start_date: Date | null;
  finish_date: Date | null;
}

function xerDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().replace('T', ' ').substring(0, 16);
}

function row(values: (string | number)[]): string {
  return values.map(v => String(v ?? '')).join('\t');
}

export class PrimaveraXmlFormatter {
  static format(project: P6Project, activities: P6Activity[], relationships: P6Relationship[]): string {
    const lines: string[] = [];

    // ── ERMHDR ──
    lines.push('%T\tERMHDR');
    lines.push('%F\tExportFormat\tExportVersion\tExportBy\tExportDate\tExportFlag');
    lines.push(row(['%R', 'XER', '22.12', 'SYORITY', xerDate(new Date()), '0']));
    lines.push('');

    // ── PROJECT ──
    lines.push('%T\tPROJECT');
    lines.push('%F\tproj_id\tproj_short_name\tname\tplan_start_date\tplan_end_date\tstatus_code');
    lines.push(row(['%R', project.id, project.name.substring(0, 20), project.name,
      xerDate(project.start_date), xerDate(project.finish_date), 'AC']));
    lines.push('');

    // ── WBS ──
    lines.push('%T\tPROJWBS');
    lines.push('%F\twbs_id\tproj_id\twbs_short_name\twbs_name\tparent_wbs_id');
    lines.push(row(['%R', `WBS-${project.id}`, project.id, project.name.substring(0, 20), project.name, '']));
    lines.push('');

    // ── TASK ──
    lines.push('%T\tTASK');
    lines.push('%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttarget_drtn_hr_cnt\ttarget_start_date\ttarget_end_date\tphys_complete_pct\ttask_type');
    for (const act of activities) {
      const durationHours = act.duration_hours;
      const taskType = act.is_milestone ? 'TT_Mile' : 'TT_Task';
      lines.push(row([
        '%R',
        act.id,
        project.id,
        `WBS-${project.id}`,
        act.activity_code ?? act.id,
        act.description,
        durationHours,
        xerDate(act.planned_start),
        xerDate(act.planned_end),
        act.percent_complete,
        taskType,
      ]));
    }
    lines.push('');

    // ── TASKPRED ──
    lines.push('%T\tTASKPRED');
    lines.push('%F\tpred_task_id\ttask_id\tpred_type\tlag_hr_cnt');
    // Build code→id map
    const codeToId = new Map(activities.map(a => [a.activity_code ?? a.id, a.id]));
    for (const rel of relationships) {
      const predId = codeToId.get(rel.predecessor_activity_code);
      const succId = codeToId.get(rel.successor_activity_code);
      if (!predId || !succId) continue;
      const lagHours = rel.lag_days * 10; // assume 10h/day
      lines.push(row(['%R', predId, succId, rel.relationship_type, lagHours]));
    }
    lines.push('');

    // ── EOF ──
    lines.push('%E');

    return lines.join('\n');
  }
}
