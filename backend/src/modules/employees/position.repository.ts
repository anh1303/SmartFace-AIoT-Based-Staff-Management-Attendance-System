import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class PositionRepository {
  async findMany(args?: Prisma.PositionFindManyArgs) {
    return prisma.position.findMany(args);
  }

  async findUnique(args: Prisma.PositionFindUniqueArgs) {
    return prisma.position.findUnique(args);
  }

  async create(args: Prisma.PositionCreateArgs) {
    return prisma.position.create(args);
  }

  async update(args: Prisma.PositionUpdateArgs) {
    return prisma.position.update(args);
  }

  async count(args?: Prisma.PositionCountArgs) {
    return prisma.position.count(args);
  }
}

export const positionRepository = new PositionRepository();
