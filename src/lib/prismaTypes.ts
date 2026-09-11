/**
 * Shared Prisma transaction type.
 *
 * Usage: any service method that needs to participate in a transaction
 * accepts `db: PrismaTransactionClient = prisma` as its last parameter.
 *
 * Architecture ref: M8.6 P0-004 (Transaction Safety)
 */
import { PrismaClient, Prisma } from '@prisma/client';

export type PrismaTransactionClient = PrismaClient | Prisma.TransactionClient;
