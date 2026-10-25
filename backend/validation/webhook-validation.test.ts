import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../src/config/database.js', () => ({prisma:{$queryRaw:vi.fn(async () => []),employee:{findFirst:vi.fn(async () => null)}}}))
import { handleThingsBoardWebhook } from '../src/modules/attendance/attendance.service.js'
import { assertDeviceWebhook } from '../src/common/device-auth.js'
import { prisma } from '../src/config/database.js'
import type { Request } from 'express'
const payload = () => ({device_id:'TEST_PI',mode:'CHECK_IN',event_id:'test-event-1234',client_timestamp:Date.now(),event_kind:'VERIFY_ONLY',recognition_id:'recognition-test-1234',antispoof_score:.9,embedding:Array(512).fill(.1)})
describe('Trusted device webhook validation', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each([undefined,NaN,Infinity,-.1,1.1,'0.9'])('rejects malformed liveness %s before matching', async score => {
    await expect(handleThingsBoardWebhook({...payload(),antispoof_score:score as number})).rejects.toThrow(/liveness/)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })
  it('blocks score zero without replacing it by one or requiring an embedding', async () => {
    const {embedding,...request} = payload()
    const result = await handleThingsBoardWebhook({...request,antispoof_score:0,event_kind:'SPOOF'})
    expect(result.success).toBe(false);expect(result.event_id).toBe(request.event_id);expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })
  it('rejects a missing event ID/mode and a nonfinite embedding', async () => {
    await expect(handleThingsBoardWebhook({...payload(),event_id:undefined})).rejects.toThrow(/event_id/)
    await expect(handleThingsBoardWebhook({...payload(),mode:'OTHER'})).rejects.toThrow(/mode/)
    const embedding = Array(512).fill(.1);embedding[10] = NaN
    await expect(handleThingsBoardWebhook({...payload(),embedding})).rejects.toThrow(/finite/)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })
  it('returns a correlated UNKNOWN without inserting attendance', async () => {
    const result = await handleThingsBoardWebhook(payload())
    expect(result.matched).toBe(false);expect(result.event_id).toBe('test-event-1234');expect(prisma.$queryRaw).toHaveBeenCalledOnce()
  })
  it('verifies without writing and refuses legacy one-shot face scans', async () => {
    const match = {emp_id:'employee-a',employee_code:'A',full_name:'Alice',avatar_url:null,embedding_type:'CENTROID',similarity:.95}
    vi.mocked(prisma.$queryRaw).mockResolvedValue([match])
    const event = 'confirmation-event-12345'
    const first = await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'recognition-first'})
    expect(first).toMatchObject({success:true,matched:true,verification_only:true,confirmation_count:1})
    const retry = await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'recognition-first'})
    expect(retry).toMatchObject({verification_only:true,confirmation_count:1})
    const second = await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'recognition-second'})
    expect(second).toMatchObject({verification_only:true,confirmation_count:2})
    expect(prisma.employee.findFirst).not.toHaveBeenCalled()
    const third = await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'recognition-third',event_kind:'CONFIRMED_SCAN',expected_employee_id:'employee-a'})
    // Null mock employee makes the writer fail, but it must only be reached now.
    expect(prisma.employee.findFirst).toHaveBeenCalledOnce()
    expect(third).not.toHaveProperty('verification_only',true)
    await expect(handleThingsBoardWebhook({...payload(),event_kind:undefined})).rejects.toThrow(/consecutive recognition/)
  })
  it('a rejected PAD resets the confirmation streak', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{emp_id:'employee-a',employee_code:'A',full_name:'Alice',avatar_url:null,similarity:.95}])
    const event = 'pad-reset-event-12345'
    await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'pad-recognition-1'})
    await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'pad-recognition-2'})
    await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'pad-recognition-3',antispoof_score:0})
    expect(await handleThingsBoardWebhook({...payload(),event_id:event,recognition_id:'pad-recognition-4'})).toMatchObject({verification_only:true,confirmation_count:1})
    expect(prisma.employee.findFirst).not.toHaveBeenCalled()
  })
  it('requires the configured shared secret' , () => {
    vi.stubEnv('TB_WEBHOOK_SECRET','test-webhook-secret-with-at-least-24-chars')
    const req = (value: string) => ({header:() => value} as unknown as Request)
    expect(() => assertDeviceWebhook(req(''))).toThrow(/authentication/)
    expect(() => assertDeviceWebhook(req('wrong-secret'))).toThrow(/authentication/)
    expect(() => assertDeviceWebhook(req(process.env.TB_WEBHOOK_SECRET!))).not.toThrow()
    vi.unstubAllEnvs()
  })
})
