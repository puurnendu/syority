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

    // M16-R6: governed tools must be registered in the Node runtime or
    // WhatsApp/Voice processInteraction has an empty registry (fail-closed no-op).
    const { registerR2ReadTools } = await import('@/core/m16/tools/readTools');
    const { registerR3WriteTools } = await import('@/core/m16/tools/writeTools');
    const { registerM15DecisionTools } = await import('@/core/m16/tools/m15Tools');
    registerR2ReadTools();
    registerR3WriteTools();
    registerM15DecisionTools();
    console.log('[Instrumentation] M16 read/write/M15 tools registered.');

    // Dynamic imports keep Node-only deps out of the Edge instrumentation graph
    const { eventBus } = await import('@/lib/eventBus');
    const { registerEventSubscribers } = await import('@/lib/eventSubscribers');
    registerEventSubscribers(eventBus);
    console.log('[Instrumentation] Event subscribers registered.');
}
