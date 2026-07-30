/**
 * M7.6G — Release Management Service
 *
 * Provides version, build, schema, environment, and release channel information.
 */

import { prisma } from '@/lib/prisma';

export interface ReleaseInfo {
  version: string;
  gitCommit: string;
  buildNumber: string;
  buildTimestamp: string;
  environment: string;
  releaseChannel: string;
  nodeVersion: string;
  schemaVersion: string;
  lastMigration: string | null;
  totalMigrations: number;
}

export class ReleaseService {

  async getReleaseInfo(): Promise<ReleaseInfo> {
    let version = '1.0.0';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      version = require('@/../package.json').version;
    } catch { /* ignore */ }

    let schemaVersion = 'unknown';
    let lastMigration: string | null = null;
    let totalMigrations = 0;

    try {
      const migrations: any[] = await prisma.$queryRaw`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at DESC
      `;
      totalMigrations = migrations.length;
      if (migrations.length > 0) {
        lastMigration = migrations[0].migration_name;
        schemaVersion = `${totalMigrations} migrations applied`;
      }
    } catch {
      schemaVersion = 'Unable to query';
    }

    return {
      version,
      gitCommit: process.env.GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'unknown',
      buildNumber: process.env.BUILD_NUMBER ?? 'local',
      buildTimestamp: process.env.BUILD_TIMESTAMP ?? new Date().toISOString(),
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
      releaseChannel: process.env.RELEASE_CHANNEL ?? 'beta',
      nodeVersion: process.version,
      schemaVersion,
      lastMigration,
      totalMigrations,
    };
  }
}

export const releaseService = new ReleaseService();
