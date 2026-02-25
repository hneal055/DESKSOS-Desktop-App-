import { io, Socket } from "socket.io-client";

const API_BASE_URL = "http://localhost:5000";
const SOCKET_URL = "http://localhost:5000";

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  status: "online" | "away" | "busy" | "offline";
}

interface TeamMember {
  id: string;
  name: string;
  status: "online" | "away" | "busy" | "offline";
  currentTickets: number;
  resolvedToday: number;
  avatar?: string;
}

interface QueueMetrics {
  new: number;
  open: number;
  inProgress: number;
  pending: number;
  resolved: number;
  overdue: number;
}

interface DashboardData {
  teamStatus: TeamMember[];
  queueMetrics: QueueMetrics;
}

interface MetricItem {
  priority: string;
  total: number;
}

interface DailyTrend {
  date: string;
  count: number;
}

interface SLAMetrics {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface ActivityFeed {
  id: string;
  user: string;
  action: string;
  ticketId: string;
  status: string;
  timestamp: string;
}

interface MetricsData {
  slaMetrics: SLAMetrics;
  metrics: MetricItem[];
  dailyTrends: DailyTrend[];
  activityFeed: ActivityFeed[];
}

interface Channel {
  id: string;
  name: string;
  type: "public" | "private";
  unreadCount: number;
  lastMessage: string;
}

interface Message {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: string;
  mentions: string[];
  channel: string;
}

class APIClient {
  private socket: Socket | null = null;
  private authToken: string | null = null;

  constructor() {
    this.authToken = localStorage.getItem("authToken") || null;
  }

  // ============ REST API Methods ============

  /**
   * Dashboard: Get team status and queue metrics
   */
  async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Dashboard: Get detailed metrics (SLA, trends, activity)
   */
  async getTicketMetrics(): Promise<ApiResponse<MetricsData>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/metrics`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Chat: Get all channels
   */
  async getChannels(): Promise<ApiResponse<Channel[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/channels`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Chat: Get message history for a channel
   */
  async getChannelMessages(channelId: string): Promise<ApiResponse<Message[]>> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/channels/${channelId}/messages`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * User: Get current user profile
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/me`, {
        method: "GET",
        headers: this.getHeaders(),
      });
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Auth: Login user
   */
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.data?.token) {
        this.setAuthToken(data.data.token);
      }
      return data;
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Auth: Register new user
   */
  async register(
    name: string,
    email: string,
    password: string
  ): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (data.data?.token) {
        this.setAuthToken(data.data.token);
      }
      return data;
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Auth: Logout user
   */
  async logout(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        headers: this.getHeaders(),
      });
      this.clearAuthToken();
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  /**
   * Health check: Verify API is running
   */
  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
      });
      return await response.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }

  // ============ WebSocket Methods ============

  /**
   * Connect to WebSocket server for real-time features
   */
  connectWebSocket(userId: string, userName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.socket?.connected) {
          resolve();
          return;
        }

        this.socket = io(SOCKET_URL, {
          auth: {
            token: this.authToken || "",
          },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        this.socket.on("connect", () => {
          console.log("WebSocket connected");

          // Emit user join event
          this.socket?.emit("user:join", {
            id: userId,
            name: userName,
          });

          resolve();
        });

        this.socket.on("connect_error", (error: any) => {
          console.error("WebSocket connection error:", error);
          reject(error);
        });

        this.socket.on("disconnect", () => {
          console.log("WebSocket disconnected");
        });

        this.socket.on("error", (error: any) => {
          console.error("WebSocket error:", error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get WebSocket instance for event listeners
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get WebSocket instance or throw error
   */
  getSocketOrThrow(): Socket {
    if (!this.socket) {
      throw new Error("WebSocket not connected. Call connectWebSocket first.");
    }
    return this.socket;
  }

  // ============ Private Helper Methods ============

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  private setAuthToken(token: string): void {
    this.authToken = token;
    localStorage.setItem("authToken", token);
  }

  private clearAuthToken(): void {
    this.authToken = null;
    localStorage.removeItem("authToken");
  }

  /**
   * Get stored auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }
}

// Export singleton instance
export const api = new APIClient();

// Export types for use in components
export type {
  User,
  TeamMember,
  QueueMetrics,
  DashboardData,
  MetricItem,
  DailyTrend,
  SLAMetrics,
  ActivityFeed,
  MetricsData,
  Channel,
  Message,
  ApiResponse,
};
