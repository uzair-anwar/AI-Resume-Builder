import { z } from "zod";

export const OutreachSendRequestSchema = z.object({
  to: z.string().email().max(200),
  subject: z.string().min(1).max(200),
  body: z.string().min(10).max(12000),
  recipientName: z.string().max(120).optional(),
});

export type OutreachSendRequest = z.infer<typeof OutreachSendRequestSchema>;

export const OutreachSendResponseSchema = z.object({
  ok: z.literal(true),
  messageId: z.string().optional(),
});