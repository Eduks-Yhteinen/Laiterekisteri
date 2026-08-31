// * 1. Zod on TypeScript-ensimmäinen skeemavalidaatiokirjasto.
// Sillä varmistamme, että tietokannasta ja kameralta tuleva data on tietoturvallista.
import { z } from 'zod';

// ! TIETOTURVA (XSS / Injektio)
// Määrittelemällä kenttien tyypit tiukasti, estämme haitallisen koodin 
// (esim. selaimessa suoritettavan HTML/JS) pääsyn UI:hin.
// * FAIL-SAFE: Koska vanhassa datassa (SharePoint) on puutteita,
// käytämme `.catch()` -metodia asettamaan oletusarvon kaatumisen sijaan.
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

// * TIETOSUOJA (GDPR & Datan minimointi)
// Henkilöön yhdistettävä tieto (PII) on eriytetty täysin laitetiedosta.
// Tätä skeemaa käytetään vain, kun käyttäjällä on ylläpitäjän oikeudet.
export const DevicePIISchema = z.object({
  Serial: z.string().min(1, "Serial is required"),
  DeviceName: z.string(),
  PrimaryUser: z.string(),
});

// * Roolipohjainen oikeuksienhallinta (RBAC)
export const UserRoleSchema = z.object({
  role: z.enum(['admin', 'viewer']),
});
