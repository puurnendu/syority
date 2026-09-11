import { redirect } from 'next/navigation';

/**
 * OD9.2 §22 — Safety is STO-only.
 *
 * This was a placeholder stub ("Phase 6 feature — coming soon"): a generic Safety surface
 * under the Project domain with no implementation behind it. §22 requires that Safety and
 * Permit Management appear only under STO → Safety & Permits, and forbids generic
 * Safety/Permit Management under Project.
 *
 * The page is retained as a redirect rather than deleted (§27 forbids removal without
 * proof, and a redirect preserves any existing bookmark). No STO Safety functionality is
 * affected: the STO surface is /safety, and `SafetyLog` requires `event_id`.
 */
export default function ProjectSafetyPage() {
  redirect('/safety');
}
