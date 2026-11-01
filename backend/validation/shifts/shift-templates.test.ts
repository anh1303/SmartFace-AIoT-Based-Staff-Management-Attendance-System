import {beforeEach,describe,it,expect,vi} from 'vitest';
const db=vi.hoisted(()=>({shiftTemplate:{findMany:vi.fn(),findFirst:vi.fn(),create:vi.fn()},auditLog:{create:vi.fn()},$executeRaw:vi.fn(),$transaction:vi.fn()}));
vi.mock('../../src/config/database.js',()=>({prisma:db}));
import {shiftTemplateSchema} from '../../src/modules/shifts/template.dto.js';
import {createShiftTemplate,listShiftTemplates} from '../../src/modules/shifts/template.service.js';
beforeEach(()=>{vi.clearAllMocks();db.$transaction.mockImplementation(fn=>fn(db));});
describe('custom shift presets',()=>{
 it('trims a named same-day shift and rejects invalid or ambiguous times',()=>{expect(shiftTemplateSchema.parse({name:'  Ca hỗ trợ  ',start_time:'18:00',end_time:'22:00'})).toEqual({name:'Ca hỗ trợ',start_time:'18:00',end_time:'22:00',note:''});for(const [start,end]of [['08:00','08:00'],['24:00','25:00'],['8:00','17:00'],['10:60','17:00']])expect(shiftTemplateSchema.safeParse({name:'Ca mới',start_time:start,end_time:end}).success).toBe(false);});
 it('rejects assignment or permission fields in catalog creation',()=>{for(const field of ['employee_id','role','shift_type','id'])expect(shiftTemplateSchema.safeParse({name:'Ca mới',start_time:'08:00',end_time:'17:00',[field]:'injected'}).success).toBe(false);});
 it('creates a reusable preset and an actor audit without rewriting attendance',async()=>{const input={name:'Ca tối',start_time:'18:00',end_time:'22:00',note:'Hỗ trợ'};db.shiftTemplate.findFirst.mockResolvedValue(null);db.shiftTemplate.create.mockResolvedValue({id:'template1',...input});await expect(createShiftTemplate(input,'actor')).resolves.toMatchObject({id:'template1'});expect(db.$executeRaw).toHaveBeenCalledTimes(1);expect(db.shiftTemplate.create).toHaveBeenCalledWith({data:input});expect(db.auditLog.create).toHaveBeenCalledWith({data:expect.objectContaining({userId:'actor',action:'CREATE_SHIFT_TEMPLATE',record_id:'template1'})});});
 it('rejects a case-insensitive duplicate before writing',async()=>{db.shiftTemplate.findFirst.mockResolvedValue({id:'existing'});await expect(createShiftTemplate({name:'CA TỐI',start_time:'18:00',end_time:'22:00',note:''},'actor')).rejects.toMatchObject({statusCode:409});expect(db.shiftTemplate.create).not.toHaveBeenCalled();expect(db.auditLog.create).not.toHaveBeenCalled();});
 it('lists reusable presets in deterministic name order',async()=>{db.shiftTemplate.findMany.mockResolvedValue([]);await listShiftTemplates();expect(db.shiftTemplate.findMany).toHaveBeenCalledWith({orderBy:[{name:'asc'},{id:'asc'}]});});
});
