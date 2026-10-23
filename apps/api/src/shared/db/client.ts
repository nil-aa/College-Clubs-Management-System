import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
export type DbClient = PrismaClient;
export type DbTransaction = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
