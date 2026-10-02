import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { successResponse } from './common/response.js';
import { apiRouter } from './routes.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((x) => x.trim()),
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check endpoint
app.get('/health', (_req, res) =>
  successResponse(res, { status: 'ok', timestamp: new Date().toISOString() })
);

// Centralized API Routes (/api/*)
app.use('/api', apiRouter);

// Global Error & 404 Handlers
app.use(notFound);
app.use(errorHandler);