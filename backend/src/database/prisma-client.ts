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

export const prisma = new PrismaClient({ adapter });
