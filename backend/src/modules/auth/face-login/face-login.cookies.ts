import type { CookieOptions, Response } from 'express'

export const FACE_LOGIN_BINDING_COOKIE = 'face_login_attempt'

export function clearFaceLoginBindingCookie(res: Response, baseOptions: CookieOptions) {
  const { maxAge: _m, expires: _e, ...clearOptions } = baseOptions
  res.clearCookie(FACE_LOGIN_BINDING_COOKIE, clearOptions)
}
