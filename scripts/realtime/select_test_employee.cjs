#!/usr/bin/env node
/**
 * scripts/select_test_employee.cjs
 * 
 * Cong cu chon/dang ky nhanh nhan vien de test diem danh tren Pi Simulator.
 * 
 * Cach dung:
 *   node scripts/select_test_employee.cjs           # Liet ke danh sach nhan vien
 *   node scripts/select_test_employee.cjs NV-002    # Chon hoac tao face embedding cho NV-002
 *   node scripts/select_test_employee.cjs "Đỗ Văn Hùng"
 */

const { PrismaClient } = require('../../backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Ham sinh 512-D float vector chuan L2 khong NaN/Inf
function generateRealisticEmbedding(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const floats = [];
  let counter = 0;
  while (floats.length < 512) {
    const block = crypto.createHash('sha256').update(Buffer.concat([hash, Buffer.from([counter >> 24, counter >> 16, counter >> 8, counter])])).digest();
    counter++;
    for (let i = 0; i < 32 && floats.length < 512; i += 4) {
      const intVal = block.readInt32LE(i);
      floats.push(intVal / 2147483648.0);
    }
  }
  // L2 Normalize
  let norm = Math.sqrt(floats.reduce((sum, v) => sum + v * v, 0));
  return floats.map(v => v / norm);
}

async function main() {
  const query = process.argv[2]?.trim();
  const outFile = path.join(__dirname, 'known_face_embedding.json');

  if (!query) {
    console.log('\n=== DANH SACH NHAN VIEN DE TEST DIEM DANH ===\n');
    const emps = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employee_code: true,
        full_name: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
        face_embeddings: {
          where: { is_active: true },
          select: { id: true, embedding_type: true },
        },
      },
      orderBy: { employee_code: 'asc' },
    });

    console.log(
      'Mã NV'.padEnd(10) +
      'Họ và tên'.padEnd(25) +
      'Khuôn mặt trong DB'.padEnd(25) +
      'Phòng ban'
    );
    console.log('-'.repeat(75));

    for (const e of emps) {
      const faceCount = e.face_embeddings.length;
      const faceStatus = faceCount > 0 ? `[Đã có ${faceCount} vector]` : '[Chưa có]';
      console.log(
        (e.employee_code || '').padEnd(10) +
        (e.full_name || '').padEnd(25) +
        faceStatus.padEnd(25) +
        (e.department?.name || '')
      );
    }


    console.log('\nCách chọn nhân viên để test:');
    console.log('  node scripts/select_test_employee.cjs <MÃ_NV>');
    console.log('Ví dụ:');
    console.log('  node scripts/select_test_employee.cjs NV-002\n');
    return;
  }

  // Tim nhan vien theo ma, UUID hoac ten
  const emp = await prisma.employee.findFirst({
    where: {
      OR: [
        { employee_code: { equals: query, mode: 'insensitive' } },
        { id: query.length === 36 ? query : undefined },
        { full_name: { contains: query, mode: 'insensitive' } },
      ],
    },
    include: {
      department: true,
      position: true,
      face_embeddings: {
        where: { is_active: true },
      },
    },
  });

  if (!emp) {
    console.error(`\n❌ Không tìm thấy nhân viên nào khớp với: "${query}"\n`);
    process.exit(1);
  }

  console.log(`\n🔍 Đã tìm thấy nhân viên: [${emp.employee_code}] ${emp.full_name} (${emp.id})`);

  let vec = null;

  if (emp.face_embeddings.length > 0) {
    // Da co face embedding -> lay vector centroid hoac sample dau tien
    console.log(`✅ Nhân viên này đã có ${emp.face_embeddings.length} vector khuôn mặt trong CSDL.`);
    const centroid = emp.face_embeddings.find(f => f.embedding_type === 'CENTROID') || emp.face_embeddings[0];
    const rows = await prisma.$queryRawUnsafe(`SELECT embedding::text as emb FROM face_embeddings WHERE id = '${centroid.id}'`);
    if (rows && rows[0]?.emb) {
      const raw = rows[0].emb.replace('[', '').replace(']', '');
      vec = raw.split(',').map(Number);
    }
  }

  if (!vec || vec.length !== 512) {
    // Chua co -> tu dong tao vector chuan va insert vao DB
    console.log(`⚠️ Nhân viên chưa có khuôn mặt trong DB -> Đang tự động tạo vector nhận diện mẫu...`);
    vec = generateRealisticEmbedding(`smartface-face-seed-for-${emp.id}`);
    const vecLiteral = '[' + vec.map(v => v.toFixed(8)).join(',') + ']';

    await prisma.$queryRawUnsafe(`
      INSERT INTO face_embeddings (
        id, employee_id, embedding, model_version, sample_tag, quality_score, is_active, embedding_type, created_at
      ) VALUES (
        gen_random_uuid(),
        '${emp.id}'::uuid,
        '${vecLiteral}'::vector,
        'buffalo_s',
        'SIMULATED_TEST',
        0.98,
        true,
        'CENTROID',
        NOW()
      )
    `);
    console.log(`✅ Đã tạo thành công vector khuôn mặt mẫu trong CSDL.`);
  }

  // Luu ra file scripts/known_face_embedding.json
  fs.writeFileSync(outFile, JSON.stringify({
    employee_id: emp.id,
    employee_code: emp.employee_code,
    full_name: emp.full_name,
    embedding: vec,
  }, null, 2));

  console.log(`\n🎉 ĐÃ CẤU HÌNH XONG CHO NHÂN VIÊN: ${emp.full_name} (${emp.employee_code})`);
  console.log(`📁 Vector khuôn mặt đã lưu vào: scripts/realtime/known_face_embedding.json`);
  console.log(`\n👉 Bây giờ bạn chỉ cần chạy lệnh sau để test điểm danh:\n`);
  console.log(`   python scripts/realtime/pi_simulator.py\n`);

}

main()
  .catch(err => {
    console.error('Lỗi:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
