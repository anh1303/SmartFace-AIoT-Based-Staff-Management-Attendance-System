import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class AuthRepository {
  async findUserByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      include: { roles: true },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
        employees: {
          include: { department: true, position: true },
        },
      },
    });
  }

  async updateLastLogin(id: string) {
    return prisma.user.update({
      where: { id },
      data: { last_login_at: new Date() },
    });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
      include: { roles: true },
    });
  }
}

export const authRepository = new AuthRepository();
