import {randomUUID} from 'node:crypto'
import {beforeAll,afterAll,describe,it,expect} from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
const enabled=process.env.RUN_POLICY_DB_TESTS==='1'
if(enabled&&![process.env.DATABASE_URL,process.env.DIRECT_URL].every(url=>url&&/^postgresql:\/\/[^@]+@127\.0\.0\.1:55439\/policy_check$/.test(url)))throw new Error('Isolated policy_check URLs required')
const suite=enabled?describe:describe.skip
suite('UI extensions with real HTTP, cookies and isolated PostgreSQL',()=>{
 let db:any,app:any,admin:any,employeeUser:any,manager:any,employee:any
 let adminAgent:ReturnType<typeof request.agent>,employeeAgent:ReturnType<typeof request.agent>,managerAgent:ReturnType<typeof request.agent>
 const prefix=`ui-${randomUUID().slice(0,8)}`,password='isolated-test-password-123',newPassword='replacement-test-password-456'
 beforeAll(async()=>{
  db=(await import('../src/config/database.js')).prisma
  app=(await import('../src/app.js')).app
  const hash=await bcrypt.hash(password,10)
  async function account(roleName:string){const role=await db.roles.upsert({where:{role_name:roleName},create:{role_name:roleName},update:{}});return db.user.create({data:{username:`${prefix}-${roleName}`,passwordHash:hash,role_id:role.id}})}
  admin=await account('ADMIN');employeeUser=await account('EMPLOYEE');manager=await account('MANAGER')
  employee=await db.employee.create({data:{employee_code:`${prefix}-EMP`,user_id:employeeUser.id,full_name:'Official Fixture Name',email:`${prefix}@example.invalid`,hourly_rate:100000}})
  adminAgent=request.agent(app);employeeAgent=request.agent(app);managerAgent=request.agent(app)
  for(const [agent,user]of [[adminAgent,admin],[employeeAgent,employeeUser],[managerAgent,manager]] as const)await agent.post('/api/auth/login').send({identifier:user.username,password}).expect(200)
 },15000)
 afterAll(async()=>{if(db)await db.$disconnect()})
 it('requires authentication, and supports an admin account without an employee',async()=>{
  await request(app).get('/api/auth/profile').expect(401)
  const res=await adminAgent.get('/api/auth/profile').expect(200)
  expect(res.body.data.account.employee_code).toBeNull();expect(res.body.data.account.role).toBe('ADMIN')
 })
 it('updates only the authenticated personal profile without changing official employment data',async()=>{
  const input={display_name:'Personal Display Name',contact_email:'contact@example.invalid',phone:'+84 900000000'}
  await employeeAgent.patch('/api/auth/profile').send({...input,employee_id:admin.id}).expect(422)
  const res=await employeeAgent.patch('/api/auth/profile').send(input).expect(200)
  expect(res.body.data.display_name).toBe(input.display_name);expect(res.body.data.account.official_name).toBe(employee.full_name)
  const official=await db.employee.findUnique({where:{id:employee.id}});expect(official.email).toBe(employee.email);expect(official.full_name).toBe(employee.full_name);expect(Number(official.hourly_rate)).toBe(100000)
  expect((await db.user.findUnique({where:{id:admin.id}})).profile).toBeNull()
 })
 it('keeps a large avatar in the API response while keeping the login cookie small',async()=>{
  const png=Buffer.concat([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1L0AAAAASUVORK5CYII=','base64'),Buffer.alloc(9000)])
  const avatar='data:image/png;base64,'+png.toString('base64')
  await adminAgent.patch('/api/auth/profile').send({display_name:'Admin fixture',contact_email:'',phone:'',avatar}).expect(200)
  const res=await request(app).post('/api/auth/login').send({identifier:admin.username,password}).expect(200)
  expect(res.body.data.user.avatar).toBe(avatar)
  const cookie=String(res.headers['set-cookie'][0]);expect(Buffer.byteLength(cookie)).toBeLessThan(3800)
  const token=decodeURIComponent(cookie.split(';')[0].slice('token='.length))
  expect(jwt.verify(token,process.env.JWT_SECRET!) as object).not.toHaveProperty('avatar')
  await adminAgent.patch('/api/auth/profile').send({display_name:'Admin fixture',contact_email:'',phone:'',avatar:null}).expect(200)
  expect((await adminAgent.get('/api/auth/profile')).body.data.avatar).toBeNull()
 })
 it('checks the current password, clears the current cookie and accepts only the new password',async()=>{
  await employeeAgent.post('/api/auth/change-password').send({current_password:'wrong-password',new_password:newPassword}).expect(400)
  const res=await employeeAgent.post('/api/auth/change-password').send({current_password:password,new_password:newPassword}).expect(200)
  expect(String(res.headers['set-cookie'][0])).toMatch(/token=;/)
  await employeeAgent.get('/api/auth/profile').expect(401)
  await request(app).post('/api/auth/login').send({identifier:employeeUser.username,password}).expect(401)
  await request(app).post('/api/auth/login').send({identifier:employeeUser.username,password:newPassword}).expect(200)
  const audits=await db.auditLog.findMany({where:{userId:employeeUser.id,action:'CHANGE_OWN_PASSWORD'},select:{new_values:true,old_values:true}})
  expect(audits).toHaveLength(1);expect(JSON.stringify(audits)).not.toContain(newPassword)
 })
 it('persists public inquiries and rejects extra fields without authentication',async()=>{
  const input={name:'Isolated Visitor',email:'visitor@example.invalid',company:'Fixture Company',plan:'PRO'}
  await request(app).post('/api/auth/solution-inquiries').send({...input,role:'ADMIN'}).expect(422)
  const res=await request(app).post('/api/auth/solution-inquiries').send(input).expect(201)
  expect(await db.solutionInquiry.findUnique({where:{id:res.body.data.requestId}})).toMatchObject(input)
 })
 it('persists custom presets, rejects invalid times/duplicates and enforces role permissions',async()=>{
  const input={name:`${prefix} Evening`,start_time:'18:00',end_time:'22:00',note:'Fixture support'}
  await request(app).get('/api/shifts/templates').expect(401)
  await employeeAgent.get('/api/shifts/templates').expect(401)
  const employeeToken=jwt.sign({id:employeeUser.id,role:'EMPLOYEE',username:employeeUser.username},process.env.JWT_SECRET!)
  await request(app).get('/api/shifts/templates').set('Authorization',`Bearer ${employeeToken}`).expect(403)
  await request(app).post('/api/shifts/templates').set('Authorization',`Bearer ${employeeToken}`).send(input).expect(403)
  await managerAgent.post('/api/shifts/templates').send({...input,end_time:'17:00'}).expect(422)
  const res=await managerAgent.post('/api/shifts/templates').send(input).expect(201)
  await adminAgent.post('/api/shifts/templates').send({...input,name:input.name.toUpperCase()}).expect(409)
  expect((await adminAgent.get('/api/shifts/templates')).body.data).toEqual(expect.arrayContaining([expect.objectContaining({id:res.body.data.id,...input})]))
  expect(await db.shiftTemplate.findUnique({where:{id:res.body.data.id}})).toMatchObject(input)
  const assigned=await adminAgent.post('/api/shifts').send({employeeId:employee.employee_code,work_date:'2035-02-12',shift_type:'OTHER',start_time:input.start_time,end_time:input.end_time,note:input.name}).expect(201)
  expect(assigned.body.data).toMatchObject({shift_type:'OTHER',start_time:'18:00',end_time:'22:00',note:input.name})
 })
})
