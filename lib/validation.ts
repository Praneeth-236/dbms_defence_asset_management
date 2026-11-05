import { z } from "zod";
import { isDecimal15Scale2 } from "./maintenance-cost.mjs";
import { isDateTimeLocal, isDecimal10Scale2, toMySqlDateTime } from "./maintenance-event-values.mjs";

const optionalNullableText = (max: number) => z.preprocess(
  (value) => typeof value === "string" ? (value.trim() || null) : value,
  z.string().max(max).nullable()
).optional();

const optionalNullableYear = z.preprocess(
  (value) => value === "" ? null : typeof value === "string" ? Number(value) : value,
  z.number().int().min(1).max(9999).nullable()
).optional();

const orderDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return year >= 1000 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "Enter a valid calendar date.");

export const workOrderSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  description: z.string().trim().min(3).max(500),
  orderDate: orderDateSchema,
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  status: z.enum(["Open", "InProgress", "Completed", "Closed"])
});

export const searchSchema = z.object({
  q: z.string().trim().max(100).optional()
});

export const assetSchema = z.object({
  assetName: z.string().trim().min(1).max(100),
  identificationNo: optionalNullableText(100),
  model: optionalNullableText(100),
  mnfYear: optionalNullableYear,
  status: optionalNullableText(30),
  criticalityLevel: optionalNullableText(20),
  unitId: z.coerce.number().int().positive(),
  assetTypeId: z.coerce.number().int().positive()
});

export const assetUpdateSchema = assetSchema.partial().refine((value) => Object.keys(value).length > 0, "Provide at least one field.");

export const dependencySchema = z.object({
  componentId: z.coerce.number().int().positive(),
  dependsOnComponentId: z.coerce.number().int().positive()
}).refine((value) => value.componentId !== value.dependsOnComponentId, {
  message: "A component cannot depend on itself."
});

export const stockSchema = z.object({
  quantity: z.coerce.number().int().min(-100000).max(100000),
  reorderLevel: z.coerce.number().int().min(0).max(100000).optional()
});

export const workOrderUpdateSchema = z.object({
  status: z.enum(["Open", "InProgress", "Completed", "Closed"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  description: z.string().trim().min(3).max(500).optional()
}).refine((value) => Object.keys(value).length > 0, "Provide at least one field.");

const decimal15Scale2 = z.string().trim().min(1).refine(
  isDecimal15Scale2,
  "Enter zero or a positive value that fits DECIMAL(15,2), with at most two fractional digits."
);

const optionalNullableDateTime = z.preprocess(
  (value) => value === "" ? null : value,
  z.string().refine(isDateTimeLocal, "Enter a valid local date and time.").transform(toMySqlDateTime).nullable()
).optional();

const optionalNullableDowntime = z.preprocess(
  (value) => typeof value === "string" ? (value.trim() || null) : value,
  z.string().refine(isDecimal10Scale2, "Enter a value that fits DECIMAL(10,2), with at most two fractional digits.").nullable()
).optional();

export const maintenanceEventSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  maintenanceType: z.string().trim().min(1).max(50),
  actionTaken: z.string().trim().max(500).optional().transform((value) => value || null),
  remarks: z.string().trim().max(500).optional().transform((value) => value || null),
  costIncurred: decimal15Scale2,
  startDateTime: optionalNullableDateTime,
  endDateTime: optionalNullableDateTime,
  downtimeHours: optionalNullableDowntime
});

export const failureEventSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  failureType: optionalNullableText(100),
  severity: optionalNullableText(20),
  occurredAt: optionalNullableDateTime,
  description: optionalNullableText(500)
});

const optionalNullableReferenceText = (max: number) => z.preprocess(
  (value) => typeof value === "string" ? (value.trim() || null) : value,
  z.string().max(max).nullable()
).optional();

export const subsystemUpdateSchema = z.object({
  subsystemName: z.string().trim().min(1).max(100).optional(),
  description: optionalNullableReferenceText(255),
  criticalityLevel: optionalNullableReferenceText(20)
}).refine((value) => Object.keys(value).length > 0, "Provide at least one field.");

export const subsystemCreateSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  subsystemName: z.string().trim().min(1).max(100),
  description: optionalNullableReferenceText(255),
  criticalityLevel: optionalNullableReferenceText(20)
});

export const componentUpdateSchema = z.object({
  componentName: z.string().trim().min(1).max(100).optional(),
  description: optionalNullableReferenceText(255),
  criticalityLevel: optionalNullableReferenceText(20),
  isRepairable: optionalNullableReferenceText(5)
}).refine((value) => Object.keys(value).length > 0, "Provide at least one field.");

export const componentCreateSchema = z.object({
  subsystemId: z.coerce.number().int().positive(),
  componentName: z.string().trim().min(1).max(100),
  description: optionalNullableReferenceText(255),
  criticalityLevel: optionalNullableReferenceText(20),
  isRepairable: optionalNullableReferenceText(5)
});
