import { z } from 'zod';

export const DeviceSchema = z.object({
  Serial: z.string().min(1, "Serial is required"),
  DeviceID: z.string().min(1, "DeviceID is required"),
  Model: z.string(),
  LastCheckIn: z.string().datetime(), // Validates ISO datetime
  AutoUpdateExpiration: z.string().datetime().nullable().optional(),
  provisionStatus: z.enum(['ACTIVE', 'INACTIVE', 'DEPROVISIONED']),
  Kustannuspaikka: z.string(),
  DeviceType: z.string(),
  LeaseStatus: z.string(),
  DeviceStatus: z.enum(['Käytössä', 'Varastossa', 'Huollossa', 'Rikkoutunut', 'Kadonnut']),
  LeaseEnd: z.string().datetime().nullable().optional(),
  LeaseType: z.string(),
});

export const DevicePIISchema = z.object({
  Serial: z.string().min(1, "Serial is required"),
  DeviceName: z.string(),
  PrimaryUser: z.string(),
});

export const UserRoleSchema = z.object({
  role: z.enum(['admin', 'viewer']),
});
