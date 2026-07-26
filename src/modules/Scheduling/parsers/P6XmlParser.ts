/**
 * Primavera P6 XML parser.
 *
 * Parses //Project/Activity and //Project/Relationship elements.
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

export interface ParsedWbs {
  external_id: string; // ObjectId
  code: string;        // Code
  name: string;
  parent_external_id: string | null;
}

export interface ParsedRelationship {
  predecessor_external_id: string;
  successor_external_id: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number; // working days
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the text content of a direct child element.
 * Uses a simple regex — avoid pulling in a full XML library for SSR compatibility.
 */
function text(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return m ? m[1].trim() : '';
}

/** Split XML into raw blocks. */
function extractBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const open = new RegExp(`<${tag}[^>]*>`, 'g');
  const close = `</${tag}>`;
  let start: RegExpExecArray | null;
  while ((start = open.exec(xml)) !== null) {
    const end = xml.indexOf(close, start.index);
    if (end === -1) break;
    blocks.push(xml.slice(start.index, end + close.length));
  }
  return blocks;
}

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

export async function parseP6Xml(
  xmlString: string,
  _projectId: string,
  _organizationId: string,
  _workpackId?: string,
  hoursPerDay = 10
): Promise<{ activities: ParsedActivity[]; relationships: ParsedRelationship[]; wbsNodes: ParsedWbs[] }> {
  const activities: ParsedActivity[] = [];
  const relationships: ParsedRelationship[] = [];
  const wbsNodes: ParsedWbs[] = [];

  // 1. Extract WBS blocks
  const wbsBlocks = extractBlocks(xmlString, 'WBS');
  for (const block of wbsBlocks) {
    const objId = text(block, 'ObjectId');
    const code  = text(block, 'Code');
    const name  = text(block, 'Name');
    const parentObjId = text(block, 'ParentObjectId');

    if (!objId) continue;
    wbsNodes.push({
      external_id: objId,
      code: code || `WBS-${objId}`,
      name: name || `WBS ${objId}`,
      parent_external_id: parentObjId || null,
    });
  }

  // 2. Extract Activity blocks
  const activityBlocks = extractBlocks(xmlString, 'Activity');

  for (const block of activityBlocks) {
    const actType = text(block, 'Type');
    
    // Skip LOE and WBS types
    if (actType === 'WBS' || actType === 'LOE') continue;

    const objId = text(block, 'ObjectId');
    const id = text(block, 'Id');
    const name = text(block, 'Name');
    const durStr = text(block, 'PlannedDuration');
    const startStr = text(block, 'PlannedStartDate');
    const endStr = text(block, 'PlannedFinishDate');
    const pctStr = text(block, 'PhysicalPercentComplete');
    const wbsId = text(block, 'WBSObjectId');

    if (!objId) continue;

    const durHr = parseFloat(durStr || '0');
    const pct = parseFloat(pctStr || '0');

    activities.push({
      external_id: objId,
      activity_code: id,
      name: name || `Activity ${objId}`,
      duration: isNaN(durHr) ? 0 : durHr / hoursPerDay,
      planned_start: parseDate(startStr),
      planned_end: parseDate(endStr),
      percent_complete: Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct)),
      budgeted_cost: null,
      constraint_type: null,
      constraint_date: null,
      wbs_code: wbsId || '', // P6 uses ObjId for WBS linkage in XML
      is_milestone: actType === 'MilestoneFlag',
    });
  }

  // 3. Extract Relationship blocks
  const relBlocks = extractBlocks(xmlString, 'Relationship');

  for (const block of relBlocks) {
    const predObjId = text(block, 'PredecessorActivityObjectId');
    const succObjId = text(block, 'SuccessorActivityObjectId');
    const typeStr = text(block, 'Type');
    const lagStr = text(block, 'Lag');

    if (!predObjId || !succObjId) continue;

    const lagHr = parseFloat(lagStr || '0');

    relationships.push({
      predecessor_external_id: predObjId,
      successor_external_id: succObjId,
      type: parseType(typeStr),
      lag: isNaN(lagHr) ? 0 : lagHr / hoursPerDay,
    });
  }

  return { activities, relationships, wbsNodes };
}
