import { randomUUID } from 'crypto';

/**
 * MS Project 2019 XML parser — reverse of MsProjectXmlFormatter.
 *
 * Parses //Project/Tasks/Task elements and their PredecessorLink children,
 * returning typed arrays that the import route can directly upsert into Prisma.
 */

export interface ParsedActivity {
  id: string;                    // Pre-generated UUID
  external_id: string;           // Task/UID
  activity_code: string;         // Task/ID (e.g. "A-1001") – used as unique key for upsert
  name: string;
  duration: number;              // working days (converted from PT{n}H)
  planned_start: Date | null;
  planned_end: Date | null;
  percent_complete: number;      // 0–100
  budgeted_cost: number | null;
  constraint_type: string | null;
  constraint_date: Date | null;
  wbs_code: string;              // OutlineNumber
  is_milestone: boolean;
}

export interface ParsedWbs {
  id: string;          // Pre-generated UUID
  external_id: string; // UID
  code: string;        // OutlineNumber
  name: string;
  parent_external_id: string | null;
  parent_id?: string | null; // Resolved UUID of parent
}

export interface ParsedRelationship {
  predecessor_external_id: string;
  successor_external_id: string;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag: number; // working days
}

// ─── constants ────────────────────────────────────────────────────────────────

const CONSTRAINT_MAP: Record<number, string> = {
  0: 'ASAP',
  1: 'ALAP',
  2: 'MSO',
  3: 'MFO',
  4: 'SNET',
  5: 'SNLT',
  6: 'FNET',
  7: 'FNLT',
};

// MS Project LinkLag type: 0=FF, 1=FS, 2=SF, 3=SS
const LINK_TYPE_MAP: Record<number, 'FS' | 'SS' | 'FF' | 'SF'> = {
  0: 'FF',
  1: 'FS',
  2: 'SF',
  3: 'SS',
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const TAG_REGEX_CACHE = new Map<string, RegExp>();

/**
 * Extracts the text content of a direct child element.
 * Optimized with a regex cache and simple string check first.
 */
function text(xml: string, tag: string): string {
  if (!xml.includes(tag)) return '';
  let regex = TAG_REGEX_CACHE.get(tag);
  if (!regex) {
    regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
    TAG_REGEX_CACHE.set(tag, regex);
  }
  const m = xml.match(regex);
  return m ? m[1].trim() : '';
}

const DUR_DAY_REGEX  = /(\d+(?:\.\d+)?)D/;
const DUR_HOUR_REGEX = /T?(\d+(?:\.\d+)?)H/;
const DUR_MIN_REGEX  = /(\d+(?:\.\d+)?)M/;

/** Parses MS Project duration notation "PT{n}H" or "PT{n}D{m}H" → hours, then → days. */
function parseDuration(durStr: string, hoursPerDay: number): number {
  if (!durStr) return 0;
  
  const dayMatch  = durStr.match(DUR_DAY_REGEX);
  const hourMatch = durStr.match(DUR_HOUR_REGEX);
  const minMatch  = durStr.match(DUR_MIN_REGEX);
  
  const days  = dayMatch  ? parseFloat(dayMatch[1]) : 0;
  const hours = hourMatch ? parseFloat(hourMatch[1]) : 0;
  const mins  = minMatch  ? parseFloat(minMatch[1]) : 0;
  
  return days + (hours / hoursPerDay) + (mins / (hoursPerDay * 60));
}

/** LinkLag is stored in 1/10 minutes. Convert to working days. */
function parseLag(lagStr: string, hoursPerDay: number): number {
  if (!lagStr) return 0;
  const tenthMinutes = parseInt(lagStr, 10);
  const totalMinutes = tenthMinutes / 10;
  return totalMinutes / (hoursPerDay * 60);
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Split XML into raw <Tag>…</Tag> blocks. Handles attributes in open tag. */
function extractBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const open = new RegExp(`<${tag}[^>]*>`, 'gi');
  const close = `</${tag}>`;
  
  let start: RegExpExecArray | null;
  while ((start = open.exec(xml)) !== null) {
    const end = xml.indexOf(close, start.index);
    if (end === -1) break;
    blocks.push(xml.slice(start.index, end + close.length));
    
    // Move regex pointer to after the close tag to avoid nested matches if any
    open.lastIndex = end + close.length;
  }
  return blocks;
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function parseMsProjectXml(
  xmlString: string,
  _projectId: string,
  _organizationId: string,
  _workpackId?: string,
  hoursPerDay = 10
): Promise<{ activities: ParsedActivity[]; relationships: ParsedRelationship[]; wbsNodes: ParsedWbs[] }> {
  const activities: ParsedActivity[] = [];
  const relationships: ParsedRelationship[] = [];
  const wbsNodes: ParsedWbs[] = [];

  // MS Project XML often has tasks in OutlineLevel order. 
  // We need to keep track of the current parent for each level to resolve ParentUID.
  const parentMap = new Map<number, string>(); // level -> uid

  // Extract all Task blocks
  const taskBlocks = extractBlocks(xmlString, 'Task');

  // To resolve parent UUIDs for WBS nodes
  const wbsUidToId = new Map<string, string>();

  for (const block of taskBlocks) {
    const uid    = text(block, 'UID');
    const outlineLevel = parseInt(text(block, 'OutlineLevel') || '0', 10);
    const isSummary = text(block, 'Summary') === '1';

    // Track hierarchy
    parentMap.set(outlineLevel, uid);
    const parentUid = outlineLevel > 0 ? parentMap.get(outlineLevel - 1) : null;

    // Project summary task (UID=0) is usually the root WBS
    if (uid === '0' || isSummary) {
      const wbsId = randomUUID();
      wbsUidToId.set(uid, wbsId);
      
      wbsNodes.push({
        id: wbsId,
        external_id: uid,
        code: text(block, 'OutlineNumber') || (uid === '0' ? '0' : ''),
        name: text(block, 'Name') || (uid === '0' ? 'Project' : `WBS ${uid}`),
        parent_external_id: parentUid || null,
        parent_id: parentUid ? wbsUidToId.get(parentUid) : null,
      });
      
      // If UID=0, we stop processing it as an activity
      if (uid === '0') continue;
    }

    // Normal activities (Summary=0)
    if (!isSummary) {
      const idStr    = text(block, 'ID');
      const name     = text(block, 'Name');
      const durStr   = text(block, 'Duration');
      const startStr = text(block, 'Start');
      const finStr   = text(block, 'Finish');
      const pctStr   = text(block, 'PercentComplete');
      const costStr  = text(block, 'Cost');
      const ctStr    = text(block, 'ConstraintType');
      const cdStr    = text(block, 'ConstraintDate');
      const outline  = text(block, 'OutlineNumber');
      const milStr   = text(block, 'Milestone');

      const constraintTypeInt = ctStr ? parseInt(ctStr, 10) : null;

      activities.push({
        id:               randomUUID(),
        external_id:      uid,
        activity_code:    `A-${idStr || uid}`,
        name:             name || `Task ${uid}`,
        duration:         parseDuration(durStr, hoursPerDay),
        planned_start:    parseDate(startStr),
        planned_end:      parseDate(finStr),
        percent_complete: pctStr ? Math.min(100, Math.max(0, parseInt(pctStr, 10))) : 0,
        budgeted_cost:    costStr ? parseFloat(costStr) : null,
        constraint_type:  constraintTypeInt != null ? (CONSTRAINT_MAP[constraintTypeInt] ?? null) : null,
        constraint_date:  parseDate(cdStr),
        wbs_code:         outline,
        is_milestone:     milStr === '1',
      });
    }

    // Relationships (only for activities or if relationships are allowed on summary tasks)
    const predBlocks = extractBlocks(block, 'PredecessorLink');
    for (const pred of predBlocks) {
      const predUID  = text(pred, 'PredecessorUID');
      const typeStr  = text(pred, 'Type');
      const lagStr   = text(pred, 'LinkLag');

      if (!predUID || predUID === '0' && isSummary) continue; // Usually skip rels on root

      const typeInt = typeStr ? parseInt(typeStr, 10) : 1; // default FS
      relationships.push({
        predecessor_external_id: predUID,
        successor_external_id:   uid,
        type:                    LINK_TYPE_MAP[typeInt] ?? 'FS',
        lag:                     parseLag(lagStr, hoursPerDay),
      });
    }
  }

  return { activities, relationships, wbsNodes };
}
