import { z } from "zod";

export const zIdNumber = z.coerce.number().int().positive();

export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(s + "T00:00:00Z")), "Not a valid calendar date");

export const moneyStr = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter amount as decimal with up to 2 places, e.g. 1250.50");

/** Parses a UI/user-entered decimal string into minor units (cents). */
export function moneyToCents(input: string): number {
  return Math.round(Number(input) * 100);
}

/** Formats minor units back to a decimal string, e.g. 125050 -> "1250.50". */
export function centsToMoney(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ---- Auth ------------------------------------------------------------------
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const createUserSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  email: z.string().trim().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Must contain a letter")
    .regex(/\d/, "Must contain a digit"),
  roleCode: z.enum(["administrator", "finance_officer", "student_affairs_officer", "hr_officer"]),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  roleCode: z
    .enum(["administrator", "finance_officer", "student_affairs_officer", "hr_officer"])
    .optional(),
  isActive: z.boolean().optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Must contain a letter")
    .regex(/\d/, "Must contain a digit")
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Must contain a letter")
    .regex(/\d/, "Must contain a digit"),
});

// ---- Students --------------------------------------------------------------
export const programmeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes only"),
  name: z.string().trim().min(3, "Programme name is required"),
  level: z.string().trim().max(30).optional().default(""),
  isActive: z.boolean().optional().default(true),
});

export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().default(""),
  programmeId: zIdNumber,
  admissionDate: dateStr,
  status: z.enum(["active", "inactive"]).optional().default("active"),
  studentNumber: z.string().trim().max(30).optional(), // optional manual override for imports
});

export const studentUpdateSchema = studentSchema.omit({ studentNumber: true });

// ---- Departments & employees ----------------------------------------------
export const departmentSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Letters, digits and dashes only"),
  name: z.string().trim().min(2, "Department name is required"),
  isActive: z.boolean().optional().default(true),
});

export const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().default(""),
  departmentId: zIdNumber,
  jobTitle: z.string().trim().max(80).optional().default(""),
  employmentDate: dateStr,
  status: z.enum(["active", "inactive"]).optional().default("active"),
  employeeNumber: z.string().trim().max(30).optional(),
});

export const employeeUpdateSchema = employeeSchema.omit({ employeeNumber: true });

// ---- Finance ---------------------------------------------------------------
export const chargeSchema = z.object({
  studentId: zIdNumber,
  category: z.enum(["tuition", "accommodation", "library", "registration", "other"]).default("tuition"),
  description: z.string().trim().min(3, "Description is required").max(200),
  amount: moneyStr,
  chargeDate: dateStr,
});

export const paymentSchema = z.object({
  studentId: zIdNumber,
  amount: moneyStr,
  method: z.enum(["cash", "bank_transfer", "card", "mobile_money", "cheque"]).default("cash"),
  reference: z.string().trim().max(60).optional().default(""),
  note: z.string().trim().max(200).optional().default(""),
  paymentDate: dateStr,
  // optional explicit allocations [{chargeId, amount}]
  allocations: z
    .array(
      z.object({
        chargeId: zIdNumber,
        amount: moneyStr,
      })
    )
    .optional(),
});

export const reversalSchema = z.object({
  reason: z.string().trim().min(5, "A short reason is required for the audit trail").max(300),
});

export const settingsSchema = z.object({
  keys: z.record(z.string(), z.string()),
});
