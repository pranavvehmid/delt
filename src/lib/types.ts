import { z } from "zod";

export const PRIORITIES = ["very_important", "priority", "later", "noise"] as const;

export const CATEGORIES = [
  "exam",
  "registration",
  "interview",
  "deadline",
  "hackathon",
  "competition",
  "announcement",
  "decision",
  "academic",
  "account",
  "scholarship",
  "placement",
  "achievement",
  "club_event",
  "newsletter",
  "promotion",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const ClassificationSchema = z.object({
  priority: z.enum(PRIORITIES),
  category: z.enum(CATEGORIES),
  summary: z.string(),
  deadline: z.string().nullable(),
  reason: z.string(),
});
export type Classification = z.infer<typeof ClassificationSchema>;

export type Correction = { from: string; subject: string; priority: Classification["priority"] };
