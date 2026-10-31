import { describe, expect, it } from 'vitest'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'

const host = 'ep-round-breeze-b3p8jbri.c-4.ap-southeast-1.aws.neon.tech'
const connection = (database: string, hostname = host) => `postgresql://user:password@${hostname}/${database}?sslmode=require&channel_binding=require`

describe('Neon integration database safety guard', () => {
  it('accepts the disposable database created by the test runner', () => {
    const url = connection('smartface_test_0123456789abcdef')
    expect(() => assertIsolatedNeonTestDatabase(url, url)).not.toThrow()
  })
  it.each(['PBL6', 'neondb', 'smartface_test_bad', 'policy_check'])('rejects existing or unrecognised database %s', database => {
    expect(() => assertIsolatedNeonTestDatabase(connection(database), connection(database))).toThrow()
  })
  it('rejects a main endpoint, different databases and missing TLS', () => {
    const safe = connection('smartface_test_0123456789abcdef')
    expect(() => assertIsolatedNeonTestDatabase(connection('smartface_test_0123456789abcdef', 'ep-icy-truth-b3077r5c.c-4.ap-southeast-1.aws.neon.tech'), safe)).toThrow()
    expect(() => assertIsolatedNeonTestDatabase(safe, connection('smartface_test_fedcba9876543210'))).toThrow()
    expect(() => assertIsolatedNeonTestDatabase(safe.replace('sslmode=require', 'sslmode=disable'), safe)).toThrow()
  })
})
