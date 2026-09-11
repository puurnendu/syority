import { redirect } from 'next/navigation';

/**
 * OD9.2 §22 — Permit Management is STO-only.
 *
 * This was a placeholder stub ("Phase 6 feature — coming soon"): a generic Permits/PTW
 * surface under the Project domain with no implementation behind it. §22 requires that
 * Safety and Permit Management appear only under STO → Safety & Permits.
 *
 * Retained as a redirect rather than deleted (§27). No STO Permit functionality is
 * affected: the STO surface is /permits.
 */
export default function ProjectPermitsPage() {
  redirect('/permits');
}
