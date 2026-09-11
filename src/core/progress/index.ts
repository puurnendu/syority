/**
 * M8.13 — Progress Intelligence Module
 *
 * Authoritative execution-progress calculation system.
 *
 * Architecture:
 *   ProgressCalculationService  — PURE math, no I/O
 *   ProgressAggregationService  — Prisma queries → delegates to CalculationService
 *   types.ts                    — Domain types
 *
 * Usage:
 *   import { ProgressAggregationService } from '@/core/progress';
 *   const progress = await ProgressAggregationService.getEventProgress(orgId, eventId);
 */

export * from './types';
export * from './ProgressCalculationService';
export { ProgressAggregationService } from './ProgressAggregationService';
