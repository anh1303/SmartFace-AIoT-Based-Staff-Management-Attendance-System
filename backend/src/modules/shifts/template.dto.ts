import { z } from 'zod';
const time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm hợp lệ');
export const shiftTemplateSchema=z.object({name:z.string().trim().min(2).max(50).transform(s=>s.normalize('NFC')),start_time:time,end_time:time,note:z.string().trim().max(300).optional().default('')}).strict().refine(value=>value.start_time<value.end_time,{message:'Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày',path:['end_time']});
export type ShiftTemplateInput=z.infer<typeof shiftTemplateSchema>;
