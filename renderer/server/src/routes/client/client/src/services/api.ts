import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import localforage from 'localforage';
import { toast } from 'sonner';

class ApiService {
  private api = axios.create({
    baseURL: process.env.API_URL || 'http://localhost:3000/api',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  private socket: Socket | null = null;
  private token: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private offlineQueue: any[] = [];

  constructor() {
    this.setupInterceptors();
    this.loadToken();
    this.initOfflineSync();
  }

  private setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      async (config) => {
        const token = await this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const token = await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            // Redirect to login
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Handle offline mode
        if (!navigator.onLine) {
          this.queueOfflineRequest(originalRequest);
          toast.info('You are offline. Request queued for sync.');
          return Promise.resolve({ data: { queued: true } });
        }

        return Promise.reject(error);
      }
    );
  }

  private async loadToken() {
    this.token = await localforage.getItem('auth_token');
  }

  private async getToken(): Promise<string | null> {
    return this.token;
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initOfflineSync() {
    window.addEventListener('online', () => {
      this.syncOfflineQueue();
    });

    // Load queued requests from storage
    const queue = await localforage.getItem('offlineQueue');
    if (queue) {
      this.offlineQueue = queue as any[];
    }
  }

  private async queueOfflineRequest(request: any) {
    this.offlineQueue.push({
      ...request,
      queuedAt: new Date().toISOString()
    });
    await localforage.setItem('offlineQueue', this.offlineQueue);
  }

  private async syncOfflineQueue() {
    if (this.offlineQueue.length === 0) return;

    toast.info('Syncing offline changes...');

    for (const request of this.offlineQueue) {
      try {
        await this.api(request);
      } catch (error) {
        console.error('Failed to sync offline request:', error);
      }
    }

    this.offlineQueue = [];
    await localforage.removeItem('offlineQueue');
    
    toast.success('Offline sync complete');
  }

  // WebSocket connection
  connectWebSocket(token: string) {
    this.socket = io(process.env.WS_URL || 'ws://localhost:3001', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      toast.success('Connected to real-time updates');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      toast.warning('Disconnected from real-time updates');
    });

    this.socket.on('ticket:updated', (data) => {
      // Emit event for components to listen to
      window.dispatchEvent(new CustomEvent('ticket-updated', { detail: data }));
      
      // Show notification
      if (data.updatedBy !== this.getCurrentUserId()) {
        toast.info(`Ticket ${data.ticketId} was updated`);
      }
    });

    this.socket.on('ticket:assigned', (data) => {
      toast.info(`You have been assigned to ticket ${data.ticketNumber}`);
      window.dispatchEvent(new CustomEvent('ticket-assigned', { detail: data }));
    });

    this.socket.on('user:status', (data) => {
      window.dispatchEvent(new CustomEvent('user-status-change', { detail: data }));
    });

    return this.socket;
  }

  disconnectWebSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Authentication
  async login(email: string, password: string): Promise<any> {
    try {
      const response = await this.api.post('/auth/login', { email, password });
      this.token = response.data.token;
      await localforage.setItem('auth_token', this.token);
      await localforage.setItem('user', response.data.user);
      
      this.connectWebSocket(this.token);
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    this.token = null;
    this.disconnectWebSocket();
    await localforage.removeItem('auth_token');
    await localforage.removeItem('user');
  }

  // API Methods
  async getTickets(params?: any) {
    return this.api.get('/tickets', { params });
  }

  async getTicket(id: string) {
    return this.api.get(`/tickets/${id}`);
  }

  async createTicket(data: any) {
    return this.api.post('/tickets', data);
  }

  async updateTicket(id: string, data: any) {
    return this.api.put(`/tickets/${id}`, data);
  }

  async addTicketNote(id: string, note: string, internal: boolean = false) {
    return this.api.post(`/tickets/${id}/notes`, { content: note, internal });
  }

  async getKnowledgeArticles(params?: any) {
    return this.api.get('/knowledge', { params });
  }

  async getKnowledgeArticle(id: string) {
    return this.api.get(`/knowledge/${id}`);
  }

  async createKnowledgeArticle(data: any) {
    return this.api.post('/knowledge', data);
  }

  async likeKnowledgeArticle(id: string) {
    return this.api.post(`/knowledge/${id}/like`);
  }

  async getUsers(params?: any) {
    return this.api.get('/users', { params });
  }

  async getUser(id: string) {
    return this.api.get(`/users/${id}`);
  }

  async updateUser(id: string, data: any) {
    return this.api.put(`/users/${id}`, data);
  }

  async getUserStatus(userId: string) {
    return this.api.get(`/users/${userId}/status`);
  }

  async getTeams() {
    return this.api.get('/teams');
  }

  async getTeam(id: string) {
    return this.api.get(`/teams/${id}`);
  }

  async getAssets(params?: any) {
    return this.api.get('/assets', { params });
  }

  async getAsset(id: string) {
    return this.api.get(`/assets/${id}`);
  }

  async getAnalytics(params?: any) {
    return this.api.get('/analytics', { params });
  }

  async getTicketMetrics(params?: any) {
    return this.api.get('/tickets/metrics/summary', { params });
  }

  async getDashboardData() {
    return this.api.get('/analytics/dashboard');
  }

  async syncOfflineData() {
    return this.api.post('/sync');
  }

  // Helper methods
  private getCurrentUserId(): string | null {
    // Get from stored user
    return null;
  }
}

export const api = new ApiService();