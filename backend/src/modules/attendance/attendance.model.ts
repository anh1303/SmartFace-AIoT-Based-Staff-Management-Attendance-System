import { prisma } from '../../config/database.js'

export const attendanceModel = prisma.attendance_logs

// attendance_logs không có quan hệ tới device (không có Device model trong schema)
// employees là relation từ attendance_logs → Employee
export const attendanceInclude = {
  employees: {
    select: {
      id: true,
      full_name: true,
      employee_code: true,
      email: true,
      position: true,
      department: true,
    },
  },
} as const
