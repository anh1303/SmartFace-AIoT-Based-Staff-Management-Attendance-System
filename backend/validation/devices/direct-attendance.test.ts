import express from 'express'
import request from 'supertest'
import { beforeEach, expect, it, vi } from 'vitest'
const { handler, findRecord } = vi.hoisted(() => ({ handler: vi.fn(), findRecord: vi.fn() }))
vi.mock('../../src/modules/attendance/attendance.service.js',()=>({handleThingsBoardWebhook:handler,findAttendanceLogByEventKey:findRecord}))
import { deviceAttendanceRouter } from '../../src/modules/attendance/attendance.device.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
const app=express();app.use(express.json());app.use('/api/devices/:id/attendance',deviceAttendanceRouter);app.use(errorHandler)
beforeEach(()=>{vi.clearAllMocks();process.env.EDGE_RECOGNITION_KEYS=JSON.stringify({PI_A:'a'.repeat(32),PI_B:'b'.repeat(32)});handler.mockResolvedValue({success:true,matched:true,door_open:true,event_id:'event-a',employee:{id:'employee',full_name:'A',avatar_url:'private-image'},attendance:{id:'1',status:'VALID'}})})
const payload={device_id:'PI_A',event_id:'event-a',event_kind:'CONFIRMED_SCAN'}
it('requires the credential of the URL device',async()=>{
 for(const key of ['', 'b'.repeat(32)]) expect((await request(app).post('/api/devices/PI_A/attendance').set('Authorization','Bearer '+key).send(payload)).status).toBe(401)
 expect(handler).not.toHaveBeenCalled()
})
it('rejects a body for another device before processing',async()=>{
 expect((await request(app).post('/api/devices/PI_A/attendance').set('Authorization','Bearer '+'a'.repeat(32)).send({...payload,device_id:'PI_B'})).status).toBe(403)
 expect(handler).not.toHaveBeenCalled()
})
it.each(['CONFIRMED_SCAN','VERIFY_ONLY','FINGERPRINT_SCAN'])('uses the existing authoritative writer for %s and removes large private fields',async event_kind=>{
 const response=await request(app).post('/api/devices/PI_A/attendance').set('Authorization','Bearer '+'a'.repeat(32)).send({...payload,event_kind})
 expect(response.status).toBe(200);expect(response.body.door_open).toBe(true)
 expect(response.body.employee).not.toHaveProperty('avatar_url');expect(response.headers['cache-control']).toBe('no-store')
 expect(handler).toHaveBeenCalledWith({...payload,event_kind})
})
it('does not fabricate success on a service failure',async()=>{
 handler.mockRejectedValue(new Error('database failure'))
 const response=await request(app).post('/api/devices/PI_A/attendance').set('Authorization','Bearer '+'a'.repeat(32)).send(payload)
 expect(response.status).toBe(500);expect(response.body.door_open).not.toBe(true)
})
it('rejects unsupported event types without processing',async()=>{
 const response=await request(app).post('/api/devices/PI_A/attendance').set('Authorization','Bearer '+'a'.repeat(32)).send({...payload,event_kind:'ARBITRARY_WRITE'})
 expect(response.status).toBe(400);expect(handler).not.toHaveBeenCalled()
})
it('preserves a non-authorizing cooldown acknowledgement',async()=>{
 handler.mockResolvedValue({success:true,matched:true,event_id:'event-a',door_open:false,ignored:true,cooldown:true})
 const response=await request(app).post('/api/devices/PI_A/attendance').set('Authorization','Bearer '+'a'.repeat(32)).send(payload)
 expect(response.body).toMatchObject({door_open:false,ignored:true,cooldown:true,event_id:'event-a'})
})

it('resolves a committed event with a device-scoped read and no gate grant', async () => {
  findRecord.mockResolvedValue({ status: 'VALID', type: 'CHECK_OUT', employee_id: 'private' })
  const response = await request(app).get('/api/devices/PI_A/attendance/status/event-id-123').set('Authorization', 'Bearer ' + 'a'.repeat(32))
  expect(response.status).toBe(200)
  expect(response.body).toEqual({ event_id: 'event-id-123', recorded: true, status: 'VALID', mode: 'CHECK_OUT' })
  const { createHash } = await import('node:crypto')
  expect(findRecord).toHaveBeenCalledWith(createHash('sha256').update('PI_A:event-id-123').digest('hex'))
  expect(handler).not.toHaveBeenCalled()
})
