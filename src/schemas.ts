import { z } from 'zod';

export const DeviceSchema = z.object({
  Serial: z.string().catch(''),
  DeviceID: z.string().catch(''),
  Model: z.string().catch('Unknown'),
  LastCheckIn: z.string().datetime().optional().catch(() => new Date().toISOString()),
  AutoUpdateExpiration: z.string().datetime().nullable().optional().catch(null),
  provisionStatus: z.enum(['ACTIVE', 'INACTIVE', 'DEPROVISIONED']).optional().catch('ACTIVE'),
  Kustannuspaikka: z.string().optional().catch(''),
  DeviceType: z.string().optional().catch('Unknown'),
  LeaseStatus: z.string().optional().catch(''),
  DeviceStatus: z.enum(['Käytössä', 'Varastossa', 'Huollossa', 'Rikkoutunut', 'Kadonnut']).optional().catch('Käytössä'),
  LeaseEnd: z.string().datetime().nullable().optional().catch(null),
  LeaseType: z.string().optional().catch(''),
});

export const DevicePIISchema = z.object({
  Serial: z.string().min(1, "Serial is required"),
  DeviceName: z.string(),
  PrimaryUser: z.string(),
});

export const UserRoleSchema = z.object({
  role: z.enum(['admin', 'viewer']),
});
