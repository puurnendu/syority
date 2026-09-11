/**
 * M16-R2 — Navigation Registry
 *
 * Deterministic route map — LLM cannot generate arbitrary URLs.
 * Routes are registered and resolved from application-verified entities.
 *
 * R0.4-E: STO campaign navigation uses the existing Event URL scheme.
 * Digital Plant / asset-register routes are not STO Project containers.
 *
 * DOES NOT:
 *   - Allow LLM to construct URLs
 *   - Expose internal implementation paths
 *   - Infer Event from Project
 */

export interface NavigationRoute {
  /** Human-readable label */
  label: string;
  /** Application URL path */
  path: string;
  /** Whether this route requires a resolved entity */
  requiresEntity: boolean;
}

interface RouteParams {
  eventId?: string;
  assetId?: string;
  workpackId?: string;
  activityId?: string;
  reportId?: string;
  /** Unused leftover. STO campaign URLs must not be built from this. */
  projectId?: string;
}

/**
 * Resolve a navigation target to a concrete URL.
 * Returns null if the target is unrecognized or missing required entities.
 */
export function resolveNavigation(
  target: string,
  params: RouteParams
): NavigationRoute | null {
  const key = target.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const { eventId, assetId, workpackId, activityId } = params;

  const routes: Record<string, () => NavigationRoute | null> = {
    equipment: () => assetId ? {
      label: 'Equipment Details',
      path: `/asset-register/${assetId}`,
      requiresEntity: true,
    } : null,

    workpack: () => workpackId ? {
      label: 'Workpack Details',
      path: `/workpacks/${workpackId}`,
      requiresEntity: true,
    } : null,

    activity: () => workpackId ? {
      label: 'Activity Inspector',
      path: `/workpacks/${workpackId}`,
      requiresEntity: true,
    } : activityId ? {
      label: 'Activity Inspector',
      path: `/planning/activities`,
      requiresEntity: true,
    } : null,

    control_tower: () => eventId ? {
      label: 'Control Tower',
      path: `/events/${eventId}/control-tower`,
      requiresEntity: false,
    } : null,

    dashboard: () => eventId ? {
      label: 'Dashboard',
      path: `/events/${eventId}/ta-dashboard`,
      requiresEntity: false,
    } : null,

    execution: () => eventId ? {
      label: 'Execution View',
      path: `/events/${eventId}/execution-readiness`,
      requiresEntity: false,
    } : null,

    schedule: () => ({
      label: 'Schedule',
      path: `/schedule`,
      requiresEntity: false,
    }),

    reports: () => eventId ? {
      label: 'Reports',
      path: `/events/${eventId}/management-intelligence`,
      requiresEntity: false,
    } : {
      label: 'Reports',
      path: `/reports`,
      requiresEntity: false,
    },

    constraints: () => eventId ? {
      label: 'Constraints',
      path: `/events/${eventId}/materials`,
      requiresEntity: false,
    } : null,

    workpacks: () => ({
      label: 'Workpacks',
      path: `/workpacks`,
      requiresEntity: false,
    }),

    delayed_workpacks: () => ({
      label: 'Delayed Workpacks',
      path: `/workpacks?status=delayed`,
      requiresEntity: false,
    }),

    critical_activities: () => ({
      label: 'Critical Activities',
      path: `/execution?filter=critical`,
      requiresEntity: false,
    }),
  };

  const resolver = routes[key];
  return resolver ? resolver() : null;
}

/**
 * Get all available navigation targets (for help/suggestions).
 */
export function getAvailableNavigations(): string[] {
  return [
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
}
