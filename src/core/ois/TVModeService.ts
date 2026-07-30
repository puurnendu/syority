/**
 * M7.6C — TV Mode Service
 *
 * Manages TV/kiosk mode sessions.
 * TV sessions are time-limited, shareable via session code or QR.
 */

import { prisma } from '@/lib/prisma';

// ─── Config ─────────────────────────────────────────────────────────────────

const DEFAULT_SESSION_HOURS = 24;
const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0/O, 1/I)

// ─── Service ────────────────────────────────────────────────────────────────

export class TVModeService {

  /**
   * Create a new TV session.
   */
  static async createSession(opts: {
    dashboardId: string;
    organizationId: string;
    startedBy: string;
    rotationIntervalSec?: number;
    autoRefreshSec?: number;
    durationHours?: number;
  }) {
    const sessionCode = TVModeService.generateSessionCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (opts.durationHours ?? DEFAULT_SESSION_HOURS));

    return prisma.ois_tv_sessions.create({
      data: {
        dashboard_id: opts.dashboardId,
        organization_id: opts.organizationId,
        session_code: sessionCode,
        rotation_interval_sec: opts.rotationIntervalSec ?? 30,
        auto_refresh_sec: opts.autoRefreshSec ?? 60,
        started_by: opts.startedBy,
        expires_at: expiresAt,
      },
    });
  }

  /**
   * Get session by code (for TV display).
   */
  static async getByCode(sessionCode: string) {
    const session = await prisma.ois_tv_sessions.findUnique({
      where: { session_code: sessionCode },
      include: {
        dashboard: {
          include: {
            pages: {
              orderBy: { sort_order: 'asc' },
              include: {
                widgets: {
                  where: { is_visible: true },
                  orderBy: { sort_order: 'asc' },
                  include: { widget_definition: true },
                },
              },
            },
            widgets: {
              where: { is_visible: true },
              orderBy: { sort_order: 'asc' },
              include: { widget_definition: true },
            },
          },
        },
      },
    });

    if (!session) return null;
    if (!session.is_active || session.expires_at < new Date()) {
      return null;
    }

    return session;
  }

  /**
   * End a TV session.
   */
  static async endSession(sessionId: string) {
    return prisma.ois_tv_sessions.update({
      where: { id: sessionId },
      data: { is_active: false },
    });
  }

  /**
   * List active TV sessions for an organization.
   */
  static async listActive(organizationId: string) {
    return prisma.ois_tv_sessions.findMany({
      where: {
        organization_id: organizationId,
        is_active: true,
        expires_at: { gt: new Date() },
      },
      include: {
        dashboard: { select: { name: true, slug: true, icon: true } },
      },
      orderBy: { started_at: 'desc' },
    });
  }

  /**
   * Clean up expired sessions.
   */
  static async cleanExpired() {
    return prisma.ois_tv_sessions.updateMany({
      where: {
        is_active: true,
        expires_at: { lte: new Date() },
      },
      data: { is_active: false },
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private static generateSessionCode(): string {
    let code = '';
    for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
      code += SESSION_CODE_CHARS.charAt(
        Math.floor(Math.random() * SESSION_CODE_CHARS.length)
      );
    }
    return code;
  }
}
