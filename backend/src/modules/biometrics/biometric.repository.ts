import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

export class BiometricRepository {
  async findMany(args: Prisma.face_embeddingsFindManyArgs) {
    return prisma.face_embeddings.findMany(args);
  }

  async count(args: Prisma.face_embeddingsCountArgs) {
    return prisma.face_embeddings.count(args);
  }

  async updateMany(args: Prisma.face_embeddingsUpdateManyArgs) {
    return prisma.face_embeddings.updateMany(args);
  }

  async deleteMany(args: Prisma.face_embeddingsDeleteManyArgs) {
    return prisma.face_embeddings.deleteMany(args);
  }
}

export const biometricRepository = new BiometricRepository();
