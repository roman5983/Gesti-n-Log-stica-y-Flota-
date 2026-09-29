import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

/**
 * Single PrismaClient instance for the whole process.
 * Prisma 7 (Rust-free client): the connection is handled by the MariaDB
 * driver adapter, which manages its own MySQL connection pool.
 * Multiple instances would exhaust MySQL connections.
 */
const adapter = new PrismaMariaDb(env.DATABASE_URL);

/**
 * Transactions run in READ COMMITTED, not MySQL's default REPEATABLE READ.
 *
 * The services serialize concurrent operations with row locks and then
 * re-read the data "under the lock" (trip → driver → vehicle in the
 * assignment, the driver in a deactivation, etc.). Under REPEATABLE READ
 * that re-read is NOT fresh: a plain SELECT sees the snapshot taken at the
 * transaction's first read, which can be older than the lock. The
 * integration tests caught it for real (28/09/2026): two assignments of the
 * same driver at once both succeeded, and a driver deleted while being
 * assigned ended up on a trip. With READ COMMITTED every read after taking a
 * lock sees what the transaction that held it committed.
 */
export const prisma = new PrismaClient({
  adapter,
  transactionOptions: { isolationLevel: 'ReadCommitted' },
});
