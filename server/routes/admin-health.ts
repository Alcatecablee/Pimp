import { Request, Response } from 'express';
import os from 'os';
import { sharedCache } from '../utils/background-refresh';
import { db } from '../db';
import { sql } from 'drizzle-orm';

// Track request metrics in memory
const requestMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalResponseTime: 0,
  lastReset: Date.now(),
  endpoints: new Map<string, {
    count: number;
    successCount: number;
    failureCount: number;
    avgResponseTime: number;
    lastAccessed: number;
  }>(),
};

// Track errors
const errorLog: Array<{
  timestamp: number;
  endpoint: string;
  error: string;
  statusCode: number;
}> = [];
const MAX_ERROR_LOG_SIZE = 100;

// Middleware to track request metrics
export function trackRequest(endpoint: string, success: boolean, responseTime: number) {
  requestMetrics.totalRequests++;
  if (success) {
    requestMetrics.successfulRequests++;
  } else {
    requestMetrics.failedRequests++;
  }
  requestMetrics.totalResponseTime += responseTime;

  // Track per-endpoint metrics
  const endpointMetrics = requestMetrics.endpoints.get(endpoint) || {
    count: 0,
    successCount: 0,
    failureCount: 0,
    avgResponseTime: 0,
    lastAccessed: Date.now(),
  };

  endpointMetrics.count++;
  if (success) {
    endpointMetrics.successCount++;
  } else {
    endpointMetrics.failureCount++;
  }
  
  // Update average response time
  const totalTime = endpointMetrics.avgResponseTime * (endpointMetrics.count - 1) + responseTime;
  endpointMetrics.avgResponseTime = totalTime / endpointMetrics.count;
  endpointMetrics.lastAccessed = Date.now();

  requestMetrics.endpoints.set(endpoint, endpointMetrics);
}

// Track error
export function trackError(endpoint: string, error: string, statusCode: number) {
  errorLog.unshift({
    timestamp: Date.now(),
    endpoint,
    error,
    statusCode,
  });

  // Keep only last MAX_ERROR_LOG_SIZE errors
  if (errorLog.length > MAX_ERROR_LOG_SIZE) {
    errorLog.length = MAX_ERROR_LOG_SIZE;
  }
}

// GET /api/admin/health - System health overview
export async function handleGetSystemHealth(req: Request, res: Response) {
  try {
    // Get system metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    const cpuUsage = os.loadavg();
    const uptime = os.uptime();

    // Get cache metrics
    const cacheStats = sharedCache.getMetrics();

    // Test database connection
    let dbStatus = 'healthy';
    let dbResponseTime = 0;
    try {
      const dbStartTime = Date.now();
      await db.execute(sql`SELECT 1`);
      dbResponseTime = Date.now() - dbStartTime;
    } catch (error) {
      dbStatus = 'error';
      console.error('[handleGetSystemHealth] Database health check failed:', error);
    }

    // Calculate uptime since last reset
    const uptimeSinceReset = Date.now() - requestMetrics.lastReset;

    // Calculate success rate
    const successRate = requestMetrics.totalRequests > 0
      ? (requestMetrics.successfulRequests / requestMetrics.totalRequests) * 100
      : 100;

    // Calculate average response time
    const avgResponseTime = requestMetrics.totalRequests > 0
      ? requestMetrics.totalResponseTime / requestMetrics.totalRequests
      : 0;

    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      system: {
        memory: {
          total: totalMemory,
          used: usedMemory,
          free: freeMemory,
          usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        },
        cpu: {
          loadAverage: {
            '1m': cpuUsage[0],
            '5m': cpuUsage[1],
            '15m': cpuUsage[2],
          },
          cores: os.cpus().length,
        },
        uptime: {
          system: uptime,
          process: process.uptime(),
          metricsSince: uptimeSinceReset,
        },
      },
      database: {
        status: dbStatus,
        responseTime: dbResponseTime,
      },
      cache: {
        type: cacheStats.cacheType,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        timeouts: cacheStats.timeouts,
        timeoutRate: cacheStats.timeoutRate,
        videosCount: cacheStats.videosCount,
        lastRefresh: cacheStats.lastRefresh,
      },
      api: {
        totalRequests: requestMetrics.totalRequests,
        successfulRequests: requestMetrics.successfulRequests,
        failedRequests: requestMetrics.failedRequests,
        successRate: Math.round(successRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[handleGetSystemHealth] Error:', error);
    res.status(500).json({
      error: 'Failed to get system health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// GET /api/admin/health/endpoints - Per-endpoint metrics
export async function handleGetEndpointMetrics(req: Request, res: Response) {
  try {
    const endpoints = Array.from(requestMetrics.endpoints.entries()).map(([path, metrics]) => ({
      path,
      totalRequests: metrics.count,
      successfulRequests: metrics.successCount,
      failedRequests: metrics.failureCount,
      successRate: metrics.count > 0 ? (metrics.successCount / metrics.count) * 100 : 100,
      avgResponseTime: Math.round(metrics.avgResponseTime * 100) / 100,
      lastAccessed: metrics.lastAccessed,
    }));

    // Sort by total requests descending
    endpoints.sort((a, b) => b.totalRequests - a.totalRequests);

    res.json({
      endpoints,
      summary: {
        totalEndpoints: endpoints.length,
        totalRequests: requestMetrics.totalRequests,
        avgResponseTime: requestMetrics.totalRequests > 0
          ? Math.round((requestMetrics.totalResponseTime / requestMetrics.totalRequests) * 100) / 100
          : 0,
      },
    });
  } catch (error) {
    console.error('[handleGetEndpointMetrics] Error:', error);
    res.status(500).json({
      error: 'Failed to get endpoint metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// GET /api/admin/health/errors - Recent errors
export async function handleGetRecentErrors(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const errors = errorLog.slice(0, limit);

    // Group errors by endpoint
    const errorsByEndpoint = new Map<string, number>();
    errors.forEach((error) => {
      errorsByEndpoint.set(error.endpoint, (errorsByEndpoint.get(error.endpoint) || 0) + 1);
    });

    const topErrors = Array.from(errorsByEndpoint.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      errors,
      summary: {
        totalErrors: errorLog.length,
        recentErrors: errors.length,
        topErrorEndpoints: topErrors,
      },
    });
  } catch (error) {
    console.error('[handleGetRecentErrors] Error:', error);
    res.status(500).json({
      error: 'Failed to get recent errors',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST /api/admin/health/reset - Reset metrics
export async function handleResetMetrics(req: Request, res: Response) {
  try {
    requestMetrics.totalRequests = 0;
    requestMetrics.successfulRequests = 0;
    requestMetrics.failedRequests = 0;
    requestMetrics.totalResponseTime = 0;
    requestMetrics.lastReset = Date.now();
    requestMetrics.endpoints.clear();
    errorLog.length = 0;

    res.json({
      success: true,
      message: 'Metrics reset successfully',
      resetAt: requestMetrics.lastReset,
    });
  } catch (error) {
    console.error('[handleResetMetrics] Error:', error);
    res.status(500).json({
      error: 'Failed to reset metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
