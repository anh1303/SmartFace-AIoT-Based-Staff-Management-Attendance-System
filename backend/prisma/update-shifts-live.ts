import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Đang cập nhật bảng work_shifts trong cơ sở dữ liệu...')

  // 1. Cập nhật Ca Hành Chính: 08:00 - 17:00
  const updatedOffice = await prisma.work_shifts.updateMany({
    where: {
      shift_name: { in: ['Ca Hành Chính', 'Ca Hanh Chinh', 'Full time'] }
    },
    data: {
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T17:00:00.000Z'),
    }
  })
  console.log(`✅ Cập nhật Ca Hành Chính: ${updatedOffice.count} bản ghi`)

  // 2. Cập nhật Ca Sáng: 08:00 - 12:00
  const updatedMorning = await prisma.work_shifts.updateMany({
    where: {
      shift_name: { in: ['Ca Sáng', 'Ca Sang', 'Part time: Ca sáng'] }
    },
    data: {
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T12:00:00.000Z'),
    }
  })
  console.log(`✅ Cập nhật Ca Sáng: ${updatedMorning.count} bản ghi`)

  // 3. Cập nhật Ca Chiều: 13:00 - 17:00
  const updatedAfternoon = await prisma.work_shifts.updateMany({
    where: {
      shift_name: { in: ['Ca Chiều', 'Ca Chieu', 'Part time: Ca chiều'] }
    },
    data: {
      start_time: new Date('1970-01-01T13:00:00.000Z'),
      end_time: new Date('1970-01-01T17:00:00.000Z'),
    }
  })
  console.log(`✅ Cập nhật Ca Chiều: ${updatedAfternoon.count} bản ghi`)

  // 4. Kiểm tra và thêm Ca khác (00:00 - 00:00) nếu chưa có
  const existingOther = await prisma.work_shifts.findFirst({
    where: {
      shift_name: { in: ['Ca khác', 'Ca Khác', 'OTHER', 'Other'] }
    }
  })

  if (!existingOther) {
    const createdOther = await prisma.work_shifts.create({
      data: {
        shift_name: 'Ca khác',
        start_time: new Date('1970-01-01T00:00:00.000Z'),
        end_time: new Date('1970-01-01T00:00:00.000Z'),
      }
    })
    console.log(`✅ Đã tạo mới bản ghi Ca khác với id = ${createdOther.id}`)
  } else {
    console.log(`ℹ️ Bản ghi Ca khác đã tồn tại với id = ${existingOther.id}`)
  }

  const allShifts = await prisma.work_shifts.findMany()
  console.log('📋 Danh sách ca hiện tại trong DB:')
  allShifts.forEach(s => {
    console.log(` - ID ${s.id}: ${s.shift_name} (${s.start_time.toISOString().slice(11, 16)} - ${s.end_time.toISOString().slice(11, 16)})`)
  })
}

main()
  .catch(e => {
    console.error('❌ Lỗi:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
