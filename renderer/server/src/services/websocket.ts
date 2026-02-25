import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { CacheService } from './cache';
import { logger } from '../config/logger';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  teams?: string[];
}

export class WebSocketService {
  private io: Server;
  private cache: CacheService;
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(io: Server, cache: CacheService) {
    this.io = io;
    this.cache = cache;
    this.initialize();
  }

  private initialize() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET!) as any;
        
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        
        // Get user's teams from cache or DB
        const teams = await this.cache.get(`user:${decoded.userId}:teams`);
        socket.teams = teams || [];
        
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    logger.info(`User ${userId} connected to WebSocket`);

    // Track socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user room
    socket.join(`user:${userId}`);

    // Join team rooms
    if (socket.teams) {
      socket.teams.forEach(teamId => {
        socket.join(`team:${teamId}`);
      });
    }

    // Join role room
    socket.join(`role:${socket.userRole}`);

    // Update user status
    this.updateUserStatus(userId, 'online');

    // Handle events
    socket.on('ticket:update', (data) => this.handleTicketUpdate(socket, data));
    socket.on('knowledge:view', (data) => this.handleKnowledgeView(socket, data));
    socket.on('user:typing', (data) => this.handleUserTyping(socket, data));
    socket.on('presence:away', () => this.handleUserAway(socket));
    socket.on('presence:busy', () => this.handleUserBusy(socket));
    socket.on('presence:online', () => this.handleUserOnline(socket));
    
    // Disconnect
    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  private async handleTicketUpdate(socket: AuthenticatedSocket, data: any) {
    const { ticketId, action, changes } = data;
    
    // Emit to relevant rooms
    this.io.to(`ticket:${ticketId}`).emit('ticket:updated', {
      ticketId,
      action,
      changes,
      userId: socket.userId,
      timestamp: new Date().toISOString()
    });

    // Emit to team if high priority
    if (changes.priority === 'critical' || changes.priority === 'high') {
      if (socket.teams) {
        socket.teams.forEach(teamId => {
          this.io.to(`team:${teamId}`).emit('ticket:high-priority', {
            ticketId,
            priority: changes.priority,
            userId: socket.userId
          });
        });
      }
    }
  }

  private async handleKnowledgeView(socket: AuthenticatedSocket, data: any) {
    const { articleId } = data;
    
    // Increment view count via API
    this.io.to(`knowledge:${articleId}`).emit('article:viewed', {
      articleId,
      userId: socket.userId,
      timestamp: new Date().toISOString()
    });
  }

  private handleUserTyping(socket: AuthenticatedSocket, data: any) {
    const { ticketId } = data;
    
    socket.to(`ticket:${ticketId}`).emit('user:typing', {
      userId: socket.userId,
      ticketId
    });
  }

  private async handleUserAway(socket: AuthenticatedSocket) {
    await this.updateUserStatus(socket.userId!, 'away');
  }

  private async handleUserBusy(socket: AuthenticatedSocket) {
    await this.updateUserStatus(socket.userId!, 'busy');
  }

  private async handleUserOnline(socket: AuthenticatedSocket) {
    await this.updateUserStatus(socket.userId!, 'online');
  }

  private async handleDisconnect(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    
    // Remove socket from tracking
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      
      // If no more sockets, user is offline
      if (userSockets.size === 0) {
        await this.updateUserStatus(userId, 'offline');
        this.userSockets.delete(userId);
      }
    }
    
    logger.info(`User ${userId} disconnected from WebSocket`);
  }

  private async updateUserStatus(userId: string, status: string) {
    await this.cache.set(`user:${userId}:status`, status, 300); // 5 minutes TTL
    
    // Broadcast to teams
    const teams = await this.cache.get(`user:${userId}:teams`);
    if (teams) {
      teams.forEach((teamId: string) => {
        this.io.to(`team:${teamId}`).emit('user:status', {
          userId,
          status,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  // Public methods for broadcasting
  public broadcastToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  public broadcastToTeam(teamId: string, event: string, data: any) {
    this.io.to(`team:${teamId}`).emit(event, data);
  }

  public broadcastToRole(role: string, event: string, data: any) {
    this.io.to(`role:${role}`).emit(event, data);
  }

  public broadcastToAll(event: string, data: any) {
    this.io.emit(event, data);
  }

  public getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  public getUserStatus(userId: string): string | undefined {
    return this.userSockets.has(userId) ? 'online' : 'offline';
  }
}