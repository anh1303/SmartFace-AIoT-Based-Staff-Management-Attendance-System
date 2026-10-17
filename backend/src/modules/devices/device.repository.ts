import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class DeviceRepository {
  async findMany(args?: Prisma.DeviceFindManyArgs) {
    return prisma.device.findMany(args);
  }

  async findUnique(args: Prisma.DeviceFindUniqueArgs) {
    return prisma.device.findUnique(args);
  }

  async create(args: Prisma.DeviceCreateArgs) {
    return prisma.device.create(args);
  }

  async update(args: Prisma.DeviceUpdateArgs) {
    return prisma.device.update(args);
  }

  async delete(args: Prisma.DeviceDeleteArgs) {
    return prisma.device.delete(args);
  }
}

export const deviceRepository = new DeviceRepository();
