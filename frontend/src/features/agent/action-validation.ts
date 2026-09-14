import { z } from "zod";
import { TOOL_MAP } from "./tools";

const actionSchema = z
  .object({
    action: z.enum(["tool", "ask", "answer", "propose"]),
    tool: z.string().optional(),
    args: z.record(z.unknown()).optional(),
    message: z.string().max(4000).optional(),
  })
  .strict();

const toolArgumentSchemas: Record<string, z.ZodType<Record<string, unknown>>> = {
  getUserProfile: z.object({}).strict(),
  getHealthProfile: z.object({}).strict(),
  getHealthContext: z.object({}).strict(),
  detectPatterns: z.object({}).strict(),
  getGoals: z.object({}).strict(),
  getSpecialistGuidance: z.object({}).strict(),
  getNotificationState: z.object({}).strict(),
  getMedicalReport: z.object({ reportId: z.string().min(1) }).strict(),
  getVerifiedMedicalResults: z.object({ reportId: z.string().min(1) }).strict(),
  getLatestLabResults: z.object({ limit: z.number().finite().min(1).max(200).optional() }).strict(),
  calculatePersonalBaseline: z
    .object({
      metric: z
        .enum([
          "sleepHours",
          "waterGlasses",
          "exerciseMinutes",
          "weightKg",
          "systolicBP",
          "diastolicBP",
          "bloodGlucose",
        ])
        .optional(),
    })
    .strict(),
  getDailyCheckins: z.object({ days: z.number().finite().min(1).max(90).optional() }).strict(),
  getHealthHistory: z
    .object({
      metric: z.string().max(40).optional(),
      limit: z.number().finite().min(1).max(200).optional(),
    })
    .strict(),
  calculateRisk: z.object({ persist: z.boolean().optional() }).strict(),
  createGoal: z
    .object({
      title: z.string().min(3).max(80),
      goalType: z.string().min(1),
      description: z.string().max(300).optional(),
      targetValue: z.number().finite().min(0).max(100000).nullable().optional(),
      unit: z.string().max(20).optional(),
      frequency: z.string().min(1).optional(),
    })
    .strict(),
  createNotification: z
    .object({
      title: z.string().min(1).max(160),
      message: z.string().max(160).optional(),
      type: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
    })
    .strict(),
  createSupportRequest: z
    .object({
      type: z.string().min(1).optional(),
      reason: z.string().min(3).max(120),
      message: z.string().max(1000).optional(),
      priority: z.enum(["low", "normal", "high"]).optional(),
    })
    .strict(),
  webSearch: z
    .object({
      query: z.string().min(1).max(200),
    })
    .strict(),
};

export type ValidatedAction = z.infer<typeof actionSchema>;

export function validateAction(
  raw: unknown,
): { ok: true; action: ValidatedAction } | { ok: false; error: string } {
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Malformed or unsupported action." };

  const action = parsed.data;

  // Strict checks for message and argument requirements based on action type
  if (action.action === "ask" || action.action === "answer") {
    if (!action.message || action.message.trim().length === 0) {
      return { ok: false, error: "Message is required for ask and answer actions." };
    }
    if (action.tool || action.args) {
      return { ok: false, error: "Only tool/propose actions may include a tool or arguments." };
    }
  }

  if (action.action === "propose") {
    if (!action.message || action.message.trim().length === 0) {
      return { ok: false, error: "Message is required for propose actions." };
    }
  }

  const needsTool = action.action === "tool" || action.action === "propose";
  if (needsTool) {
    if (!action.tool || !TOOL_MAP.has(action.tool)) return { ok: false, error: "Unknown tool." };
    const args = action.args ?? {};
    const schema = toolArgumentSchemas[action.tool];
    if (schema) {
      const validArgs = schema.safeParse(args);
      if (!validArgs.success) return { ok: false, error: "Invalid tool arguments." };
    }
  } else if (action.tool || action.args) {
    return { ok: false, error: "Only tool/propose actions may include a tool or arguments." };
  }

  return { ok: true, action };
}
