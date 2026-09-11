/**
 * R0.4-E — M16 STO navigation is Event-authoritative.
 */
import { describe, expect, it } from 'vitest';
import { resolveNavigation } from '../navigation/NavigationRegistry';

const EVENT_A = 'evt-ta-2027';

describe('R0.4-E M16 Event navigation', () => {
  it('M16 Event context produces Event URLs', () => {
    const dashboard = resolveNavigation('dashboard', { eventId: EVENT_A });
    const tower = resolveNavigation('control_tower', { eventId: EVENT_A });
    expect(dashboard?.path).toBe(`/events/${EVENT_A}/ta-dashboard`);
    expect(tower?.path).toBe(`/events/${EVENT_A}/control-tower`);
  });

  it('does not emit STO /projects/{id} campaign URLs', () => {
    const targets = [
      'equipment',
      'workpack',
      'activity',
      'control_tower',
      'dashboard',
      'execution',
      'schedule',
      'reports',
      'constraints',
      'workpacks',
      'delayed_workpacks',
      'critical_activities',
    ];
    for (const target of targets) {
      const route = resolveNavigation(target, {
        eventId: EVENT_A,
        assetId: 'asset-1',
        workpackId: 'wp-1',
        activityId: 'act-1',
        projectId: 'proj-should-be-ignored',
      });
      if (route) {
        expect(route.path).not.toMatch(/^\/projects\//);
      }
    }
  });

  it('control tower without Event does not guess a Project URL', () => {
    const route = resolveNavigation('control_tower', { projectId: 'proj-1' });
    expect(route).toBeNull();
  });

  it('workpack and equipment use existing entity routes, not Project', () => {
    expect(resolveNavigation('workpack', { eventId: EVENT_A, workpackId: 'wp-1' })?.path)
      .toBe('/workpacks/wp-1');
    expect(resolveNavigation('equipment', { eventId: EVENT_A, assetId: 'a-1' })?.path)
      .toBe('/asset-register/a-1');
  });
});
