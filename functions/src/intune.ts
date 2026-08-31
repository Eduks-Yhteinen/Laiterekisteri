import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { FirestoreDevice, FirestoreDevicePII, IntuneDevice } from "./types";

const INTUNE_CLIENT_ID = functions.params.defineSecret("INTUNE_CLIENT_ID");
const INTUNE_CLIENT_SECRET = functions.params.defineSecret("INTUNE_CLIENT_SECRET");
const INTUNE_TENANT_ID = functions.params.defineString("INTUNE_TENANT_ID");

// Helper to authenticate with MSAL
async function getGraphToken(clientId: string, clientSecret: string, tenantId: string): Promise<string | null> {
  const msalConfig = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      clientSecret,
    }
  };
  const cca = new ConfidentialClientApplication(msalConfig);
  const clientCredentialRequest = {
    scopes: ["https://graph.microsoft.com/.default"],
  };

  try {
    const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
    return response?.accessToken || null;
  } catch (error) {
    console.error("Error acquiring MS Graph token:", error);
    return null;
  }
}

// The actual sync logic
export const syncIntuneWindows = functions.scheduler.onSchedule(
  {
    schedule: "every saturday 01:00",
    secrets: [INTUNE_CLIENT_ID, INTUNE_CLIENT_SECRET],
  },
  async (event) => {
    const clientId = INTUNE_CLIENT_ID.value();
    const clientSecret = INTUNE_CLIENT_SECRET.value();
    const tenantId = INTUNE_TENANT_ID.value();

    if (!clientId || !clientSecret || !tenantId) {
      console.error("Missing Intune credentials.");
      return;
    }

    const token = await getGraphToken(clientId, clientSecret, tenantId);
    if (!token) {
      console.error("Failed to get Intune token");
      return;
    }

    const db = admin.firestore();
    let url = "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices?$filter=operatingSystem eq 'Windows'";

    try {
      while (url) {
        const res = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (!res.ok) {
          console.error(`Graph API Error: ${res.statusText}`);
          break;
        }

        const data = await res.json();
        const devices: IntuneDevice[] = data.value || [];

        const batch = db.batch();

        for (const device of devices) {
          // Skip if missing critical identifiers
          if (!device.serialNumber) continue;
          
          // Data Minimization
          const publicData: FirestoreDevice = {
            Serial: device.serialNumber,
            DeviceID: device.id,
            Model: device.model || "Unknown",
            LastCheckIn: device.lastSyncDateTime,
            DeviceType: "Windows",
            provisionStatus: "ACTIVE"
          };

          const piiData: FirestoreDevicePII = {
            Serial: device.serialNumber,
            DeviceName: device.deviceName || "Unknown",
            PrimaryUser: device.userPrincipalName || "Unassigned"
          };

          // We use set(..., { merge: true }) so we don't overwrite financial data
          // that might have been inputted locally via Firestore.
          const deviceRef = db.collection("devices").doc(device.serialNumber);
          batch.set(deviceRef, publicData, { merge: true });

          const piiRef = db.collection("device_pii").doc(device.serialNumber);
          batch.set(piiRef, piiData, { merge: true });
        }

        await batch.commit();

        // Handle pagination
        url = data["@odata.nextLink"] || null;
      }
      
      console.log("Intune sync completed successfully.");
    } catch (error) {
      console.error("Intune sync failed:", error);
    }
  }
);
