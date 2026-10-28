import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import {asyncHandler} from '../../middlewares/asyncHandler.js';
import {prisma} from '../../config/database.js';
import {successResponse} from '../../common/response.js';
export const inquirySchema=z.object({name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(254),company:z.string().trim().min(2).max(150),plan:z.enum(['STARTER','PRO','ENTERPRISE']).optional()}).strict();
export const inquiryRouter=Router();
inquiryRouter.post('/',rateLimit({windowMs:15*60*1000,limit:5,standardHeaders:'draft-8',legacyHeaders:false,message:{success:false,message:'Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau 15 phút.'}}),asyncHandler(async(req,res)=>{const input=inquirySchema.parse(req.body);const record=await prisma.solutionInquiry.create({data:input,select:{id:true,createdAt:true}});successResponse(res,{requestId:record.id,createdAt:record.createdAt},'Đã tiếp nhận yêu cầu tư vấn',201);}));
