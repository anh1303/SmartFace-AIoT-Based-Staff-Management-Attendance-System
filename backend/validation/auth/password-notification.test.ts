import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ sendMail: vi.fn(), env: { SMTP_HOST: 'smtp.example.test', SMTP_PORT: 587, SMTP_SECURE: false, SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: 'noreply@example.test' } }))
vi.mock('../../src/config/env.js', () => ({ env: state.env }))
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: state.sendMail }) } }))
import { sendPasswordChangedEmail } from '../../src/common/email.service.js'

describe('password change notification', () => {
  beforeEach(() => { state.sendMail.mockReset(); state.env.SMTP_USER = ''; state.env.SMTP_PASS = '' })
  it('reports unavailable when SMTP is not configured', async () => {
    expect(await sendPasswordChangedEmail('user@example.test')).toBe('unavailable')
    expect(state.sendMail).not.toHaveBeenCalled()
  })
  it('sends a notification without any password when SMTP is configured', async () => {
    state.env.SMTP_USER = 'account'; state.env.SMTP_PASS = 'secret'; state.sendMail.mockResolvedValue({})
    expect(await sendPasswordChangedEmail('user@example.test')).toBe('sent')
    expect(state.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.test', subject: expect.stringContaining('Mật khẩu') }))
    expect(JSON.stringify(state.sendMail.mock.calls)).not.toContain('secret')
  })
  it('reports delivery failure without claiming that mail was sent', async () => {
    state.env.SMTP_USER = 'account'; state.env.SMTP_PASS = 'secret'; state.sendMail.mockRejectedValue(new Error('SMTP error'))
    expect(await sendPasswordChangedEmail('user@example.test')).toBe('failed')
  })
})
