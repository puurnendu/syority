/**
 * M11-R0 Test 7.4 — Import Deprecation Verification
 *
 * Verifies that all P6/MPP schedule import routes are deprecated (410 Gone)
 * and cannot create or mutate native schedule data.
 *
 * Does NOT test equipment/plant/scope/workpack imports — those are unaffected.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('M11-R0 Import Deprecation', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Route Source Code Verification
  // ═══════════════════════════════════════════════════════════════════════════

  const deprecatedRoutes = [
    {
      name: 'P6 XER Import',
      path: 'app/api/projects/[id]/import/p6-xer/route.ts',
    },
    {
      name: 'P6 XML Import',
      path: 'app/api/projects/[id]/import/p6-xml/route.ts',
    },
    {
      name: 'MS Project Import',
      path: 'app/api/projects/[id]/import/ms-project/route.ts',
    },
    {
      name: 'Import Batch',
      path: 'app/api/projects/[id]/import/[batchId]/route.ts',
    },
    {
      name: 'Import Status',
      path: 'app/api/projects/[id]/import/status/route.ts',
    },
  ];

  describe.each(deprecatedRoutes)('$name', ({ name, path: routePath }) => {
    it('route file exists', () => {
      const fullPath = path.resolve(process.cwd(), routePath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });

    it('contains @deprecated annotation', () => {
      const fullPath = path.resolve(process.cwd(), routePath);
      const source = fs.readFileSync(fullPath, 'utf-8');
      expect(source).toContain('@deprecated');
    });

    it('returns 410 status code or deprecated status', () => {
      const fullPath = path.resolve(process.cwd(), routePath);
      const source = fs.readFileSync(fullPath, 'utf-8');
      // Most routes return 410 Gone. The status route returns 200 with deprecated status.
      const has410 = source.includes('410');
      const hasDeprecatedStatus = source.includes("'deprecated'") || source.includes('"deprecated"');
      expect(has410 || hasDeprecatedStatus).toBe(true);
    });

    it('does NOT import parseP6 or parseMSProject', () => {
      const fullPath = path.resolve(process.cwd(), routePath);
      const source = fs.readFileSync(fullPath, 'utf-8');
      expect(source).not.toContain('parseP6');
      expect(source).not.toContain('parseMSProject');
      expect(source).not.toContain('parseXml');
    });

    it('does NOT import prisma (cannot mutate DB)', () => {
      const fullPath = path.resolve(process.cwd(), routePath);
      const source = fs.readFileSync(fullPath, 'utf-8');
      expect(source).not.toContain("from '@/lib/prisma'");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Schedule Import UI Removal
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Schedule Import UI removal', () => {
    it('Dashboard layout does NOT contain Schedule Import nav item', () => {
      const layoutPath = path.resolve(process.cwd(), 'app/(dashboard)/layout.tsx');
      const source = fs.readFileSync(layoutPath, 'utf-8');
      expect(source).not.toContain("'Schedule Import'");
      expect(source).not.toContain("'/integrations/import'");
    });

    it('Dashboard layout does NOT contain imported-schedule nav', () => {
      const layoutPath = path.resolve(process.cwd(), 'app/(dashboard)/layout.tsx');
      const source = fs.readFileSync(layoutPath, 'utf-8');
      expect(source).not.toContain("'/imported-schedule'");
    });

    it('ScheduleRibbon does NOT contain Import button', () => {
      const ribbonPath = path.resolve(process.cwd(), 'src/components/Schedule/ScheduleRibbon.tsx');
      const source = fs.readFileSync(ribbonPath, 'utf-8');
      expect(source).not.toContain('FiUpload');
      expect(source).not.toContain('onImport}');
    });

    it('NavBar does NOT map imported-schedule', () => {
      const navPath = path.resolve(process.cwd(), 'src/components/NavBar.tsx');
      const source = fs.readFileSync(navPath, 'utf-8');
      expect(source).not.toContain("'/imported-schedule'");
    });

    it('GlobalBreadcrumb does NOT contain imported-schedule', () => {
      const breadcrumbPath = path.resolve(process.cwd(), 'src/components/GlobalBreadcrumb.tsx');
      const source = fs.readFileSync(breadcrumbPath, 'utf-8');
      expect(source).not.toContain("'imported-schedule'");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Non-Import Routes Are Not Affected
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Non-schedule imports are preserved', () => {
    const preservedPaths = [
      'app/api/workpacks',
      'src/components/Schedule',
      'src/core/schedule',
    ];

    it.each(preservedPaths)('%s directory still exists', (dirPath) => {
      const fullPath = path.resolve(process.cwd(), dirPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CPM Authority Verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('CPM authority', () => {
    it('schedule route POST imports ScheduleOrchestrationService (not SchedulingService)', () => {
      const routePath = path.resolve(process.cwd(), 'app/api/projects/[id]/schedule/route.ts');
      const source = fs.readFileSync(routePath, 'utf-8');
      expect(source).toContain('ScheduleOrchestrationService');
      expect(source).not.toContain('SchedulingService');
    });

    it('activity update route imports ScheduleOrchestrationService', () => {
      const routePath = path.resolve(
        process.cwd(),
        'app/api/projects/[id]/schedule/activities/[activityId]/route.ts'
      );
      const source = fs.readFileSync(routePath, 'utf-8');
      expect(source).toContain('ScheduleOrchestrationService');
      expect(source).not.toContain('SchedulingService');
    });

    it('SchedulingService is marked @deprecated', () => {
      const servicePath = path.resolve(
        process.cwd(),
        'src/modules/Scheduling/Services/SchedulingService.ts'
      );
      const source = fs.readFileSync(servicePath, 'utf-8');
      expect(source).toContain('@deprecated');
    });
  });
});
