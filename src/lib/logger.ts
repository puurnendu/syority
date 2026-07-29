/**
 * Centralized Logger — Syority Platform
 *
 * Standardized logging across all subsystems.
 *
 * Production (NODE_ENV=production): JSON output for log aggregation.
 * Development: Human-readable colored output.
 *
 * Levels: DEBUG < INFO < WARN < ERROR < AUDIT
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Redis', 'Connection established', { host: 'localhost' });
 *   logger.error('VertexAI', 'Call failed', { model, error: err.message });
 *   logger.audit('Auth', 'Login successful', { userId, ip });
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  AUDIT: 4,
};

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toUpperCase();
  if (env && env in LOG_LEVEL_PRIORITY) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getMinLevel()];
}

const isProduction = process.env.NODE_ENV === 'production';

function formatMessage(
  level: LogLevel,
  subsystem: string,
  message: string,
  meta?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();

  if (isProduction) {
    // JSON structured logging for production log aggregation
    return JSON.stringify({
      timestamp,
      level,
      subsystem,
      message,
      ...(meta ? { meta } : {}),
    });
  }

  // Human-readable format for development
  const prefix = `[${timestamp}] [${level}] [${subsystem}]`;
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `${prefix} ${message}${metaStr}`;
}

function log(
  level: LogLevel,
  subsystem: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  const formatted = formatMessage(level, subsystem, message, meta);

  switch (level) {
    case 'ERROR':
      console.error(formatted);
      break;
    case 'WARN':
      console.warn(formatted);
      break;
    case 'DEBUG':
      console.debug(formatted);
      break;
    case 'AUDIT':
      // Audit logs always go to stdout (structured) for compliance
      console.log(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug(subsystem: string, message: string, meta?: Record<string, unknown>): void {
    log('DEBUG', subsystem, message, meta);
  },

  info(subsystem: string, message: string, meta?: Record<string, unknown>): void {
    log('INFO', subsystem, message, meta);
  },

  warn(subsystem: string, message: string, meta?: Record<string, unknown>): void {
    log('WARN', subsystem, message, meta);
  },

  error(subsystem: string, message: string, meta?: Record<string, unknown>): void {
    log('ERROR', subsystem, message, meta);
  },

  /**
   * Audit log — always emitted regardless of LOG_LEVEL.
   * Used for compliance-critical events: auth, data mutations, admin actions.
   */
  audit(subsystem: string, action: string, meta?: Record<string, unknown>): void {
    log('AUDIT', subsystem, action, meta);
  },
};
