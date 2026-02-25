import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createConnection } from 'typeorm';
import redis from 'redis';
import winston from 'winston';
import dotenv from 'dotenv';

// Import configurations
import { dbConfig } from './config/database';
import { redisConfig } from './config/redis';
import { logger } from './config/logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import ticketRoutes from './routes/tickets';
import knowledgeRoutes from './routes/knowledge';
import assetRoutes from './routes/assets';
import analyticsRoutes from './routes/analytics';
import teamRoutes from './routes/teams';
import settingsRoutes from './routes/settings';

// Import services
import { WebSocketService } from './services/websocket';
import { CacheService } from './services/cache';
import { AuditService } from './services/audit';
import { SyncService } from './services/sync';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    credentials: true
  },
  path: '/ws'
});

// Initialize services
const redisClient = redis.createClient(redisConfig);
const cacheService = new CacheService(redisClient);
const wsService = new WebSocketService(io, cacheService);
const auditService = new AuditService(logger);
const syncService = new SyncService(cacheService, wsService);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.get('X-Request-ID')
  });
  next();
});

// Database connection
createConnection(dbConfig)
  .then(async (connection) => {
    logger.info('Connected to database');
    
    // Run migrations
    await connection.runMigrations();
    logger.info('Database migrations completed');
  })
  .catch((error) => {
    logger.error('Database connection failed:', error);
    process.exit(1);
  });

// Redis connection
redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (error) => {
  logger.error('Redis error:', error);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/tickets', authMiddleware, ticketRoutes);
app.use('/api/knowledge', authMiddleware, knowledgeRoutes);
app.use('/api/assets', authMiddleware, assetRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/teams', authMiddleware, teamRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      redis: redisClient.isReady ? 'connected' : 'disconnected',
      websocket: 'running'
    }
  });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    redisClient.quit(() => {
      logger.info('Redis connection closed');
      
      process.exit(0);
    });
  });
});

export { app, server, io, cacheService, wsService, auditService, syncService };