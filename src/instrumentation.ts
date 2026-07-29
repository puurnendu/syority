/**
 * Next.js evaluates instrumentation for both Node.js and Edge.
 * Prisma/pg must never be statically imported here — Edge cannot resolve
 * Node built-ins such as util/types (pulled in by pg).
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') {
        return;
    }

    // ── M7.5.1: Validate required configuration at startup ────────────────────
    const { validateRequiredConfig } = await import('@/lib/configValidator');
    validateRequiredConfig();

    // Dynamic imports keep Node-only deps out of the Edge instrumentation graph
    const { eventBus } = await import('@/lib/eventBus');
    const { registerEventSubscribers } = await import('@/lib/eventSubscribers');
    registerEventSubscribers(eventBus);
    console.log('[Instrumentation] Event subscribers registered.');
}
