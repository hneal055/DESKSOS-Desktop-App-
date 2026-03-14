export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "technician";
}

export interface SafeUser extends Omit<User, "password"> {}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: "open" | "in-progress" | "resolved";
  priority: "P1" | "P2" | "P3";
  assignee_id: string | null;
  assignee_name: string | null;
  requester: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketResponse {
  id: string;
  title: string;
  description: string;
  status: "open" | "in-progress" | "resolved";
  priority: "P1" | "P2" | "P3";
  assigneeId: string | null;
  assigneeName: string | null;
  requester: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface Channel {
  id: string;
  name: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface AssetRow {
  id: string;
  code: string;
  type: string;
  status: string;
  serial_number: string;
  location: string;
  assigned_user: string;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  description: string;
  technician: string;
}

export interface AssetResponse extends Omit<AssetRow, "serial_number" | "assigned_user"> {
  serialNumber: string;
  assignedUser: string;
  maintenanceHistory: MaintenanceRecord[];
}

export interface TeamMember {
  id: string;
  name: string;
  status: "online" | "away" | "offline";
  activeTickets: number;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  name?: string;
}
