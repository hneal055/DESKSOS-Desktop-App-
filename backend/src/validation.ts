import { z } from "zod";

// Auth
export const LoginSchema = z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(1, "Password required"),
});

export const RegisterSchema = z.object({
  name:     z.string().min(1, "Name required").max(100),
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// Tickets
const VALID_STATUSES   = ["open", "in-progress", "resolved"] as const;
const VALID_PRIORITIES = ["P1", "P2", "P3"] as const;

export const CreateTicketSchema = z.object({
  title:        z.string().min(1, "title required").max(200),
  description:  z.string().max(2000).optional().default(""),
  priority:     z.enum(VALID_PRIORITIES).optional().default("P3"),
  assigneeId:   z.string().uuid().optional().nullable(),
  assigneeName: z.string().max(100).optional().nullable(),
  requester:    z.string().max(100).optional().nullable(),
});

export const PatchTicketSchema = z.object({
  status: z.enum(VALID_STATUSES, { message: "Invalid status value" }),
});

// Chat
export const PostMessageSchema = z.object({
  text: z.string().min(1, "Message text required").max(2000),
});

export type LoginInput        = z.infer<typeof LoginSchema>;
export type RegisterInput     = z.infer<typeof RegisterSchema>;
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type PatchTicketInput  = z.infer<typeof PatchTicketSchema>;
export type PostMessageInput  = z.infer<typeof PostMessageSchema>;
