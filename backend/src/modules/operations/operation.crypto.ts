import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export function encryptPayload(payload: unknown, secret: string): Buffer {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), nonce)
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return Buffer.concat([nonce, cipher.getAuthTag(), data])
}
export function decryptPayload(data: Buffer, secret: string): any {
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(secret).digest(), data.subarray(0, 12))
  decipher.setAuthTag(data.subarray(12, 28))
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'))
}
