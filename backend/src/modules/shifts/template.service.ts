import {prisma} from '../../config/database.js';
import {AppError} from '../../common/AppError.js';
import type {ShiftTemplateInput} from './template.dto.js';
export function listShiftTemplates(){return prisma.shiftTemplate.findMany({orderBy:[{name:'asc'},{id:'asc'}]});}
export async function createShiftTemplate(input:ShiftTemplateInput,userId:string){return prisma.$transaction(async tx=>{
  const key=`shift-template:${input.name.toLocaleLowerCase('vi-VN')}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  const existing=await tx.shiftTemplate.findFirst({where:{name:{equals:input.name,mode:'insensitive'}}});
  if(existing)throw new AppError(409,'Tên ca đã có. Vui lòng chọn tên khác.');
  const record=await tx.shiftTemplate.create({data:input});
  await tx.auditLog.create({data:{userId,action:'CREATE_SHIFT_TEMPLATE',target_table:'shift_templates',record_id:record.id,new_values:{...input}}});
  return record;
});}
