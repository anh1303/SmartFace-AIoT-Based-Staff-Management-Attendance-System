import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'

interface ValidationTarget {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
}

/**
 * Middleware validate DTO/Schema bằng Zod.
 * Hỗ trợ truyền 1 ZodSchema đơn lẻ (mặc định validate req.body)
 * hoặc truyền object { body, query, params }.
 */
export function validate(target: ValidationTarget | ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (target && 'parse' in target && typeof target.parse === 'function') {
        req.body = (target as ZodSchema).parse(req.body)
      } else {
        const schemas = target as ValidationTarget
        if (schemas.body) req.body = schemas.body.parse(req.body)
        if (schemas.query) req.query = schemas.query.parse(req.query)
        if (schemas.params) req.params = schemas.params.parse(req.params)
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}

export const validateBody = (schema: ZodSchema) => validate({ body: schema })
export const validateQuery = (schema: ZodSchema) => validate({ query: schema })
export const validateParams = (schema: ZodSchema) => validate({ params: schema })
