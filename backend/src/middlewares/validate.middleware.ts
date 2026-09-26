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
        const parsedBody = (target as ZodSchema).parse(req.body)
        Object.defineProperty(req, 'body', {
          value: parsedBody,
          writable: true,
          enumerable: true,
          configurable: true,
        })
      } else {
        const schemas = target as ValidationTarget
        if (schemas.body) {
          const parsedBody = schemas.body.parse(req.body)
          Object.defineProperty(req, 'body', {
            value: parsedBody,
            writable: true,
            enumerable: true,
            configurable: true,
          })
        }
        if (schemas.query) {
          const parsedQuery = schemas.query.parse(req.query)
          Object.defineProperty(req, 'query', {
            value: parsedQuery,
            writable: true,
            enumerable: true,
            configurable: true,
          })
        }
        if (schemas.params) {
          const parsedParams = schemas.params.parse(req.params)
          Object.defineProperty(req, 'params', {
            value: parsedParams,
            writable: true,
            enumerable: true,
            configurable: true,
          })
        }
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
