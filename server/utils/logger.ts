import pino from 'pino';
import { db } from '../db';
import { logs } from '../../shared/schema';

// Create Pino logger instance
const isDevelopment = process.env.NODE_ENV !== 'production';
// Detect serverless environments (Vercel, Netlify, AWS Lambda) where pino-pretty doesn't work
const isServerless = Boolean(
  process.env.VERCEL || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.env.NETLIFY ||
  process.env.AWS_EXECUTION_ENV
);

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  // CRITICAL: Never use pino-pretty in serverless (Vercel, Netlify, AWS Lambda)
  // It requires dynamic module loading which breaks serverless deployments
  // Only use pretty printing in local development (non-serverless)
  transport: !isServerless && isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
});

// Log levels that should be persisted to database
const PERSIST_LEVELS = new Set(['warn', 'error', 'fatal']);

// Persist log to database for critical logs (warn, error, fatal)
export async function persistLog(
  level: string,
  message: string,
  context?: {
    requestId?: string;
    userId?: string;
    endpoint?: string;
    statusCode?: number;
    error?: Error | unknown;
    metadata?: Record<string, unknown>;
  }
) {
  // Only persist warn, error, and fatal logs to reduce database load
  if (!PERSIST_LEVELS.has(level)) {
    return;
  }

  try {
    const errorStack =
      context?.error instanceof Error
        ? context.error.stack
        : typeof context?.error === 'string'
        ? context.error
        : undefined;

    await db.insert(logs).values({
      level,
      message,
      requestId: context?.requestId,
      userId: context?.userId,
      endpoint: context?.endpoint,
      statusCode: context?.statusCode,
      errorStack,
      context: context?.metadata ? context.metadata : undefined,
    });
  } catch (error) {
    // Don't throw errors from logging system - just log to console
    console.error('[persistLog] Failed to persist log to database:', error);
  }
}

// Enhanced logger methods with database persistence
export const appLogger = {
  info: (message: string, context?: Record<string, unknown>) => {
    logger.info(context || {}, message);
  },

  warn: async (
    message: string,
    context?: {
      requestId?: string;
      userId?: string;
      endpoint?: string;
      statusCode?: number;
      metadata?: Record<string, unknown>;
    }
  ) => {
    logger.warn(context?.metadata || {}, message);
    await persistLog('warn', message, context);
  },

  error: async (
    message: string,
    error?: Error | unknown,
    context?: {
      requestId?: string;
      userId?: string;
      endpoint?: string;
      statusCode?: number;
      metadata?: Record<string, unknown>;
    }
  ) => {
    const errorMessage =
      error instanceof Error
        ? `${message}: ${error.message}`
        : message;
    
    logger.error(
      {
        ...(context?.metadata || {}),
        error: error instanceof Error ? error.stack : String(error),
      },
      errorMessage
    );

    await persistLog('error', errorMessage, { ...context, error });
  },

  fatal: async (
    message: string,
    error?: Error | unknown,
    context?: {
      requestId?: string;
      userId?: string;
      endpoint?: string;
      statusCode?: number;
      metadata?: Record<string, unknown>;
    }
  ) => {
    const errorMessage =
      error instanceof Error
        ? `${message}: ${error.message}`
        : message;
    
    logger.fatal(
      {
        ...(context?.metadata || {}),
        error: error instanceof Error ? error.stack : String(error),
      },
      errorMessage
    );

    await persistLog('fatal', errorMessage, { ...context, error });

    // Trigger alert for fatal errors
    await triggerAlert(errorMessage, 'fatal', context);
  },

  debug: (message: string, context?: Record<string, unknown>) => {
    logger.debug(context || {}, message);
  },
};

// Alert system for critical errors
async function triggerAlert(
  message: string,
  level: string,
  context?: {
    requestId?: string;
    userId?: string;
    endpoint?: string;
    statusCode?: number;
    metadata?: Record<string, unknown>;
  }
) {
  // TODO: Implement webhook/email notifications for production
  // For now, just log to console with high visibility
  console.error('\n🚨 CRITICAL ALERT 🚨');
  console.error(`Level: ${level.toUpperCase()}`);
  console.error(`Message: ${message}`);
  console.error(`Endpoint: ${context?.endpoint || 'N/A'}`);
  console.error(`Request ID: ${context?.requestId || 'N/A'}`);
  console.error(`User ID: ${context?.userId || 'N/A'}`);
  console.error(`Status Code: ${context?.statusCode || 'N/A'}`);
  if (context?.metadata) {
    console.error(`Metadata:`, JSON.stringify(context.metadata, null, 2));
  }
  console.error('🚨 END ALERT 🚨\n');
}

// Create child logger with additional context (e.g., request ID)
export function createRequestLogger(requestId: string, userId?: string) {
  return {
    info: (message: string, metadata?: Record<string, unknown>) => {
      appLogger.info(message, { ...metadata, requestId, userId });
    },
    warn: (
      message: string,
      context?: {
        endpoint?: string;
        statusCode?: number;
        metadata?: Record<string, unknown>;
      }
    ) => {
      appLogger.warn(message, { ...context, requestId, userId });
    },
    error: (
      message: string,
      error?: Error | unknown,
      context?: {
        endpoint?: string;
        statusCode?: number;
        metadata?: Record<string, unknown>;
      }
    ) => {
      appLogger.error(message, error, { ...context, requestId, userId });
    },
    fatal: (
      message: string,
      error?: Error | unknown,
      context?: {
        endpoint?: string;
        statusCode?: number;
        metadata?: Record<string, unknown>;
      }
    ) => {
      appLogger.fatal(message, error, { ...context, requestId, userId });
    },
    debug: (message: string, metadata?: Record<string, unknown>) => {
      appLogger.debug(message, { ...metadata, requestId, userId });
    },
  };
}
