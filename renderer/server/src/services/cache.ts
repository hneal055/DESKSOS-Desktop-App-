import { RedisClientType } from 'redis';
import { logger } from '../config/logger';

export class CacheService {
  private client: RedisClientType;
  private defaultTTL: number = 3600; // 1 hour

  constructor(client: RedisClientType) {
    this.client = client;
  }

  async get(key: string): Promise<any> {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  async remember(key: string, ttl: number, callback: () => Promise<any>): Promise<any> {
    const cached = await this.get(key);
    if (cached) {
      return cached;
    }

    const fresh = await callback();
    await this.set(key, fresh, ttl);
    return fresh;
  }

  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      logger.error(`Cache invalidate pattern error for ${pattern}:`, error);
    }
  }

  // User specific methods
  async cacheUserSession(userId: string, session: any): Promise<void> {
    await this.set(`user:${userId}:session`, session, 86400); // 24 hours
  }

  async getUserSession(userId: string): Promise<any> {
    return this.get(`user:${userId}:session`);
  }

  async invalidateUserSession(userId: string): Promise<void> {
    await this.del(`user:${userId}:session`);
  }

  // Ticket specific methods
  async cacheTicket(ticketId: string, ticket: any): Promise<void> {
    await this.set(`ticket:${ticketId}`, ticket, 1800); // 30 minutes
  }

  async getTicket(ticketId: string): Promise<any> {
    return this.get(`ticket:${ticketId}`);
  }

  async invalidateTicket(ticketId: string): Promise<void> {
    await this.del(`ticket:${ticketId}`);
    await this.invalidatePattern(`ticket:${ticketId}:*`);
  }

  // Queue methods
  async addToQueue(queueName: string, item: any): Promise<void> {
    await this.client.rPush(queueName, JSON.stringify(item));
  }

  async popFromQueue(queueName: string): Promise<any> {
    const item = await this.client.lPop(queueName);
    return item ? JSON.parse(item) : null;
  }

  async getQueueLength(queueName: string): Promise<number> {
    return this.client.lLen(queueName);
  }

  // Rate limiting
  async checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
    const current = await this.client.incr(key);
    
    if (current === 1) {
      await this.client.expire(key, window);
    }
    
    return current <= limit;
  }

  // Locking mechanism for distributed operations
  async acquireLock(lockKey: string, ttl: number = 30): Promise<boolean> {
    const result = await this.client.setNX(lockKey, 'locked');
    if (result) {
      await this.client.expire(lockKey, ttl);
      return true;
    }
    return false;
  }

  async releaseLock(lockKey: string): Promise<void> {
    await this.del(lockKey);
  }

  // Metrics and counters
  async incrementCounter(counterKey: string, increment: number = 1): Promise<number> {
    return this.client.incrBy(counterKey, increment);
  }

  async getCounter(counterKey: string): Promise<number> {
    const value = await this.client.get(counterKey);
    return value ? parseInt(value) : 0;
  }

  // Pub/Sub for real-time events
  async publish(channel: string, message: any): Promise<void> {
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    
    await subscriber.subscribe(channel, (message) => {
      callback(JSON.parse(message));
    });
  }
}