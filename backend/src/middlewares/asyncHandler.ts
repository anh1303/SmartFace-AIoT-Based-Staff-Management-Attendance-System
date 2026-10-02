import type { Request, Response, NextFunction, RequestHandler } from 'express';

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<any> | any;

/**
 * Wraps an async Express route handler to catch any rejected promises
 * and forward the error to Express error middleware (`next(error)`),
 * eliminating repetitive boilerplate try/catch blocks across controllers.
 */
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
