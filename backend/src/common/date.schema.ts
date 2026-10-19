import { z } from 'zod'

/** Reject normalized dates such as Feb 31 rather than assigning a different workday. */
export const workDateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine(value => {
    const timestamp = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value &&
      Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2100
  }, 'Ngày phải tồn tại, theo YYYY-MM-DD, năm 2000–2100')
