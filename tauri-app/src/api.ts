const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

function getToken(): string | null {
  return localStorage.getItem("desksos_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  createdAt: string;
}

export interface QueueCounts {
  open: number;
  inProgress: number;
  resolved: number;
  avgResponseTime: number;
}

// Auth
export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // Tickets
  getTickets: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${params.status}` : "";
    return request<Ticket[]>(`/tickets${qs}`);
  },

  createTicket: (data: {
    title: string;
    description?: string;
    priority?: "P1" | "P2" | "P3";
    requester?: string;
  }) =>
    request<Ticket>("/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  patchTicket: (id: string, status: string) =>
    request<Ticket>(`/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Dashboard
  getQueue: () => request<QueueCounts>("/dashboard/queue"),

  // Health
  health: () => request<{ status: string }>("/health"),
};
