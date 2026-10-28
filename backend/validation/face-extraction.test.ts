import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest'
import express from 'express'
import request from 'supertest'
import {authenticateFaceExtraction, faceExtractionLimiter, extractDeviceFace} from '../src/modules/devices/face-extraction.js'
import {asyncHandler} from '../src/middlewares/asyncHandler.js'
import {errorHandler} from '../src/middlewares/errorHandler.js'

const token = 'device-key-'.padEnd(40, 'x'), internalKey = 'internal-key-'.padEnd(40, 'y')
const body = {request_id:'a'.repeat(32), image_png_b64:'a'.repeat(44), model_sha256:'b'.repeat(64), model_version:'buffalo_s'}
const vector = Buffer.alloc(2048)
for (let i=0; i<512; i++) vector.writeFloatLE(1 / Math.sqrt(512), i*4)
const result = {...body, embedding_b64:vector.toString('base64'), inference_ms:12, secret:'must-not-escape'}
const app=express();app.use(express.json());app.post('/devices/:id/face-embedding', asyncHandler(authenticateFaceExtraction),faceExtractionLimiter,asyncHandler(extractDeviceFace));app.use(errorHandler)
const send=(id='TEST_PI',credential=token,data=body)=>request(app).post(`/devices/${id}/face-embedding`).set('Authorization',`Bearer ${credential}`).send(data)

describe('Device extraction gateway (no DB or attendance writes)',()=>{
 beforeEach(()=>{
  vi.stubEnv('REMOTE_RECOGNITION_ENABLED','true');vi.stubEnv('EDGE_RECOGNITION_KEYS',JSON.stringify({TEST_PI:token}));vi.stubEnv('FACE_AUTH_INTERNAL_KEY',internalKey)
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,status:200,json:async()=>result})))
 })
 afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()})
 it('disabled by default and requires a key bound to the route device',async()=>{
  vi.stubEnv('REMOTE_RECOGNITION_ENABLED','false');await send().expect(503)
  vi.stubEnv('REMOTE_RECOGNITION_ENABLED','true');await send('TEST_PI','wrong').expect(401);await send('OTHER_PI').expect(401)
  expect(fetch).not.toHaveBeenCalled()
 })
 it('rejects malformed images, oversized payloads, extra fields and incompatible models before upstream',async()=>{
  await send('TEST_PI',token,{...body,image_png_b64:'x'.repeat(60001)}).expect(422)
  await send('TEST_PI',token,{...body,model_version:'different'}).expect(422)
  await send('TEST_PI',token,{...body,employee_id:'injected'} as any).expect(422)
  expect(fetch).not.toHaveBeenCalled()
 })
 it('passes only the internal credential upstream, echoes correlation and allowlists output',async()=>{
  const res=await send().expect(200)
  expect(res.body).toEqual({request_id:body.request_id,embedding_b64:result.embedding_b64,model_sha256:body.model_sha256,model_version:body.model_version,inference_ms:12})
  const args=vi.mocked(fetch).mock.calls[0][1]!
  expect(args.headers).toEqual({'Content-Type':'application/json','X-Face-Auth-Key':internalKey});expect(args.redirect).toBe('error');expect(args.signal).toBeInstanceOf(AbortSignal)
  expect(JSON.parse(args.body as string)).toEqual(body)
 })
 it('fails closed on timeouts, upstream failure, wrong correlation and invalid vectors',async()=>{
  vi.mocked(fetch).mockRejectedValueOnce(new Error('sensitive-network-details'));const error=await send().expect(502);expect(JSON.stringify(error.body)).not.toContain('sensitive')
  vi.mocked(fetch).mockResolvedValueOnce({ok:false,status:429} as Response);await send().expect(429)
  for(const change of [{request_id:'0'.repeat(32)},{model_sha256:'0'.repeat(64)},{embedding_b64:Buffer.alloc(2048).toString('base64')},{embedding_b64:'invalid'}]){
   vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({...result,...change})} as Response);await send().expect(502)
  }
  await send().expect(200) // Capacity released after every failure.
 })
 it('rejects excess concurrent work rather than growing a stale-frame queue',async()=>{
  let finish!:(v:any)=>void
  const gate=new Promise(resolve=>{finish=resolve})
  vi.mocked(fetch).mockImplementation(async()=>{await gate;return {ok:true,json:async()=>result} as Response})
  const running=Array.from({length:4},()=>send().then(res=>res.status))
  for(let n=0;n<100&&vi.mocked(fetch).mock.calls.length<4;n++)await new Promise(resolve=>setTimeout(resolve,2))
  try{expect(vi.mocked(fetch).mock.calls.length).toBe(4);await send().expect(429)}finally{finish(null)}
  expect(await Promise.all(running)).toEqual([200,200,200,200])
 })
})
