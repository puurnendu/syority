import ExcelJS from 'exceljs';
import { ExecutionWriteService, ExecutionActionParams, ExecutionAction } from './ExecutionWriteService';
import { prisma } from '@/lib/prisma';

export class ExecutionExcelAdapter {
  /**
   * Parse an Excel file and execute bulk state mutations.
   * Expects columns: Activity ID, Action, Progress, Notes, Delay Category, Delay Severity, Delay Title, Delay Description, Hold Category, Hold Reason.
   */
  static async importExecutionUpdate(
    orgId: string,
    userId: string,
    fileBuffer: Buffer,
    eventId: string
  ) {
    if (!eventId) {
      throw new Error('eventId is required for Excel execution import.');
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new Error('No worksheets found in Excel file.');
    }

    // Read header row
    const headers = sheet.getRow(1).values as string[];
    // Standardize headers
    const colMap: Record<string, number> = {};
    headers.forEach((h, index) => {
      if (h) {
        colMap[h.toString().toLowerCase().replace(/[^a-z0-9]/g, '')] = index;
      }
    });

    const getCol = (names: string[]) => {
      for (const name of names) {
        const idx = colMap[name.toLowerCase().replace(/[^a-z0-9]/g, '')];
        if (idx !== undefined) return idx;
      }
      return -1;
    };

    const activityIdCol = getCol(['activityid', 'activitynumber', 'id']);
    const actionCol = getCol(['action', 'status']);
    const progressCol = getCol(['progress', 'percent', 'percentage']);
    const notesCol = getCol(['notes', 'comments']);
    
    // Delay info
    const delayCategoryCol = getCol(['delaycategory']);
    const delaySeverityCol = getCol(['delayseverity']);
    const delayTitleCol = getCol(['delaytitle']);
    const delayDescCol = getCol(['delaydescription']);

    // Hold info
    const holdCategoryCol = getCol(['holdcategory']);
    const holdReasonCol = getCol(['holdreason']);

    if (activityIdCol === -1 || actionCol === -1) {
      throw new Error('Excel must contain Activity ID and Action columns.');
    }

    const actions: ExecutionActionParams[] = [];
    const errors: string[] = [];

    // Map Activity Numbers to IDs if they used activity numbers
    const activityNumbersToResolve = new Set<string>();

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      
      const rawId = row.getCell(activityIdCol).value?.toString();
      if (!rawId) return;

      if (!rawId.startsWith('act_')) {
        activityNumbersToResolve.add(rawId);
      }
    });

    const activityMap = new Map<string, string>();
    if (activityNumbersToResolve.size > 0) {
      const activities = await prisma.activity.findMany({
        where: {
          organization_id: orgId,
          event_id: eventId,
          activity_number: { in: Array.from(activityNumbersToResolve) },
          deleted_at: null,
        },
        select: { id: true, activity_number: true },
      });
      const counts = new Map<string, number>();
      for (const a of activities) {
        if (!a.activity_number) continue;
        counts.set(a.activity_number, (counts.get(a.activity_number) ?? 0) + 1);
      }
      for (const a of activities) {
        if (!a.activity_number) continue;
        if ((counts.get(a.activity_number) ?? 0) > 1) {
          errors.push(`Activity number '${a.activity_number}' is ambiguous within this event`);
          continue;
        }
        activityMap.set(a.activity_number, a.id);
      }
    }

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      
      const rawId = row.getCell(activityIdCol).value?.toString()?.trim();
      if (!rawId) return;

      const activityId = rawId.startsWith('act_') ? rawId : activityMap.get(rawId);
      if (!activityId) {
        errors.push(`Row ${rowNumber}: Could not resolve Activity ID/Number '${rawId}'`);
        return;
      }

      const action = row.getCell(actionCol).value?.toString()?.trim().toUpperCase() as ExecutionAction;
      if (!action) {
        errors.push(`Row ${rowNumber}: Action is required`);
        return;
      }

      const progressRaw = progressCol === -1 ? undefined : row.getCell(progressCol).value;
      let progress: number | undefined;
      if (progressRaw !== undefined && progressRaw !== null) {
        progress = typeof progressRaw === 'number' ? progressRaw : parseFloat(progressRaw.toString());
      }

      const notes = notesCol === -1 ? undefined : row.getCell(notesCol).value?.toString();
      const delayCategory = delayCategoryCol === -1 ? undefined : row.getCell(delayCategoryCol).value?.toString();
      const delaySeverity = delaySeverityCol === -1 ? undefined : row.getCell(delaySeverityCol).value?.toString();
      const delayTitle = delayTitleCol === -1 ? undefined : row.getCell(delayTitleCol).value?.toString();
      const delayDescription = delayDescCol === -1 ? undefined : row.getCell(delayDescCol).value?.toString();
      
      const holdCategory = holdCategoryCol === -1 ? undefined : row.getCell(holdCategoryCol).value?.toString();
      const holdReason = holdReasonCol === -1 ? undefined : row.getCell(holdReasonCol).value?.toString();

      let delayDetails;
      if (delayCategory || delayTitle) {
        delayDetails = {
          category: delayCategory || 'General',
          severity: delaySeverity || 'medium',
          title: delayTitle || 'Delay reported via Excel',
          description: delayDescription || '',
        };
      }

      actions.push({
        activityId,
        action,
        progress,
        notes,
        delayDetails,
        hold_category: holdCategory,
        hold_reason: holdReason,
      });
    });

    if (errors.length > 0 && actions.length === 0) {
      return { success: false, errors };
    }

    const bulkResult = await ExecutionWriteService.bulkApplyAction(orgId, userId, actions, {
      source_channel: 'excel',
      eventId,
    });

    const finalResult = {
      success: true,
      processed: actions.length,
      successes: bulkResult.filter(r => r.success).length,
      failures: bulkResult.filter(r => !r.success).length,
      details: bulkResult,
      parseErrors: errors,
    };

    return finalResult;
  }
}
