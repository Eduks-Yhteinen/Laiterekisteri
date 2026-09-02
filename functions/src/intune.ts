import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { FirestoreDevice, FirestoreDevicePII, IntuneDevice } from "./types";

const INTUNE_CLIENT_ID = functions.params.defineSecret("INTUNE_CLIENT_ID");
const INTUNE_CLIENT_SECRET = functions.params.defineSecret("INTUNE_CLIENT_SECRET");
const INTUNE_TENANT_ID = functions.params.defineString("INTUNE_TENANT_ID");

// * How does this work? (Authentication)
// This helper function acquires a Microsoft Graph API access token using the OAuth 2.0 Client Credentials flow.
// It uses `@azure/msal-node` to authenticate our server-to-server application (this Firebase Function)
// against the Azure Active Directory tenant. The token allows us to call the Intune API without user interaction.
// The `.default` scope grants all application permissions configured in the Azure portal for this client ID.
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

// * How does this work? (Scheduled Sync)
// This is a cron job that runs every hour on Firebase. It pulls all devices from Intune
// and synchronizes them into our local Firestore database (`devices` and `device_pii` collections).
export const syncIntuneDevices = functions.scheduler.onSchedule(
  {
    schedule: "every 1 hours",
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
    let url = "https://graph.microsoft.com/v1.0/deviceManagement/managedDevices";
    const syncedSerials = new Set<string>();

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

          syncedSerials.add(device.serialNumber);

          // Dynamically map Intune OS to our DeviceType categories
          let mappedDeviceType = "Unknown";
          const os = (device.operatingSystem || "").toLowerCase();
          if (os.includes("windows")) {
            mappedDeviceType = "Windows";
          } else if (os.includes("android")) {
            mappedDeviceType = "Android";
          } else if (os.includes("ios") || os.includes("ipados") || os.includes("macos")) {
            mappedDeviceType = "Apple";
          }

          // Data Minimization
          const publicData: FirestoreDevice = {
            Serial: device.serialNumber,
            DeviceID: device.id,
            Model: device.model || "Unknown",
            LastCheckIn: device.lastSyncDateTime,
            DeviceType: mappedDeviceType,
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

        // * How does this work? (Pagination)
        // Intune API returns a maximum number of records per request (default 1000). 
        // If there are more devices, it provides an `@odata.nextLink` URL in the response.
        // The while loop continues fetching this URL until all devices are retrieved.
        url = data["@odata.nextLink"] || null;
      }

      // * How does this work? (Ghost Device Cleanup)
      // "Ghost devices" are devices that exist in our local Firestore but have been deleted or unenrolled from Intune.
      // After successfully fetching ALL current devices from Intune (tracked in `syncedSerials`),
      // we query our local database for all devices managed by Intune. If a local device is NOT in the `syncedSerials` set,
      // we know it was removed from Intune, so we delete it from both `devices` and `device_pii` collections to keep data clean.
      if (syncedSerials.size > 0) {
        console.log(`Successfully synced ${syncedSerials.size} devices from Intune.`);

        // Fetch all local devices that are managed by Intune
        const localIntuneDevicesSnapshot = await db.collection("devices")
          .where("DeviceType", "in", ["Windows", "Apple", "Android", "Unknown"])
          .get();

        const deleteBatch = db.batch();
        let deleteCount = 0;

        for (const doc of localIntuneDevicesSnapshot.docs) {
          const serial = doc.id;
          if (!syncedSerials.has(serial)) {
            // Device exists locally but not in Intune -> Delete ghost device
            deleteBatch.delete(doc.ref);
            deleteBatch.delete(db.collection("device_pii").doc(serial));
            deleteCount++;
          }
        }

        if (deleteCount > 0) {
          await deleteBatch.commit();
          console.log(`Deleted ${deleteCount} ghost Intune devices.`);
        }
      }

      console.log("Intune sync completed successfully.");
    } catch (error) {
      console.error("Intune sync failed:", error);
    }
  }
);

export const updateIntuneDevice = functions.https.onCall(
  { secrets: [INTUNE_CLIENT_ID, INTUNE_CLIENT_SECRET, INTUNE_TENANT_ID] },
  async (request) => {
    // * How does this work? (RBAC - Role-Based Access Control)
    // This Callable function is invoked directly from the frontend React app.
    // 1. Authentication & Authorization Check:
    // First, we verify that the user is logged in (`request.auth`).
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const email = request.auth.token.email || "";
    if (!email.endsWith("@edu.lappeenranta.fi") && !email.endsWith("@lappee.fi")) {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized domain.");
    }

    const db = admin.firestore();

    // * How does this work? (Admin Validation)
    // We check if the user is a hardcoded "Global Admin".
    // If not, we query the `user_roles` collection in Firestore to see if they were manually granted the "admin" role.
    // The "asentaja@lappee.fi" account is also given a hardcoded admin pass.
    // If they aren't an admin, the function throws a `permission-denied` error, stopping the execution securely on the backend.
    const isGlobalAdmin = email === "pasi.hulkkonen@edu.lappeenranta.fi" || email === "joni.hikipaa@edu.lappeenranta.fi";

    let isAdmin = isGlobalAdmin;
    if (!isAdmin) {
      const roleDoc = await db.collection("user_roles").doc(request.auth.uid).get();
      isAdmin = (roleDoc.exists && roleDoc.data()?.role === "admin") || email === "asentaja@lappee.fi";
    }

    if (!isAdmin) {
      throw new functions.https.HttpsError("permission-denied", "Only Admins can update devices.");
    }

    // 2. Validate Input
    const { deviceId, serialNumber, deviceName, primaryUser } = request.data;

    if (!deviceId || !serialNumber) {
      throw new functions.https.HttpsError("invalid-argument", "Missing deviceId or serialNumber.");
    }

    // 3. Update Intune
    const clientId = INTUNE_CLIENT_ID.value();
    const clientSecret = INTUNE_CLIENT_SECRET.value();
    const tenantId = INTUNE_TENANT_ID.value();

    const token = await getGraphToken(clientId, clientSecret, tenantId);
    if (!token) {
      throw new functions.https.HttpsError("internal", "Failed to authenticate with Microsoft Graph.");
    }

    const patchBody: any = {};
    if (deviceName !== undefined) patchBody.deviceName = deviceName;
    if (primaryUser !== undefined) patchBody.userPrincipalName = primaryUser;

    if (Object.keys(patchBody).length === 0) {
      return { success: true, message: "No changes requested." };
    }

    // * How does this work? (Updating Intune)
    // We make a PATCH request to the specific device's URL in the Microsoft Graph API.
    // The body contains only the fields that were modified.
    const url = `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/${deviceId}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patchBody)
    });

    if (!res.ok) {
      console.error("Intune PATCH failed:", res.status, res.statusText);
      throw new functions.https.HttpsError("internal", `Failed to update Intune: ${res.statusText}`);
    }

    // 4. Update local Firestore for immediate UI reflection
    const batch = db.batch();
    if (deviceName !== undefined || primaryUser !== undefined) {
      const piiRef = db.collection("device_pii").doc(serialNumber);
      batch.set(piiRef, {
        ...(deviceName !== undefined && { DeviceName: deviceName }),
        ...(primaryUser !== undefined && { PrimaryUser: primaryUser })
      }, { merge: true });
    }
    await batch.commit();

    return { success: true };
  }
);
