/**
 * Next.js 16 webpack `next build` discovers instrumentation as a file next to
 * the live `./app` directory (project root), not only `src/instrumentation.ts`.
 * Implementation lives in src/instrumentation.ts.
 */
export { register } from './src/instrumentation';
