/**
 * Sinh mật khẩu ngẫu nhiên độ dài mặc định 8 ký tự.
 * Đảm bảo chứa cả chữ hoa, chữ thường và chữ số để an toàn và bảo mật.
 */
export function generateRandomPassword(length = 8): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const all = upper + lower + digits

  const chars: string[] = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ]

  for (let i = 3; i < length; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)])
  }

  // Xáo trộn ngẫu nhiên (Fisher-Yates shuffle)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}
