import { timeAttendanceQuery } from '../common/attendance-timing.js'
import { PrismaClient } from '@prisma/client'

const prismaGlobal = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = prismaGlobal.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] })
if (!prismaGlobal.prisma) prisma.$use((params, next) => timeAttendanceQuery(`${params.model ?? 'raw'}.${params.action}`, () => next(params)))

if (process.env.NODE_ENV !== 'production') prismaGlobal.prisma = prisma
