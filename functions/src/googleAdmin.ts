import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { OAuth2Client } from "google-auth-library";
import { FirestoreDevice, FirestoreDevicePII, GoogleChromeDevice } from "./types";

const GOOGLE_ADMIN_CLIENT_ID = functions.params.defineSecret("GOOGLE_ADMIN_CLIENT_ID");
const GOOGLE_ADMIN_CLIENT_SECRET = functions.params.defineSecret("GOOGLE_ADMIN_CLIENT_SECRET");
const GOOGLE_ADMIN_REFRESH_TOKEN = functions.params.defineSecret("GOOGLE_ADMIN_REFRESH_TOKEN");
const GOOGLE_ADMIN_CUSTOMER_ID = functions.params.defineString("GOOGLE_ADMIN_CUSTOMER_ID");

// Helper to authenticate with Google API
async function getGoogleAuthClient(clientId: string, clientSecret: string, refreshToken: string) {
  const oAuth2Client = new OAuth2Client(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
  return oAuth2Client;
}

export const syncGoogleChrome = functions.scheduler.onSchedule(
  {
    schedule: "every 1 hours",
    secrets: [GOOGLE_ADMIN_CLIENT_ID, GOOGLE_ADMIN_CLIENT_SECRET, GOOGLE_ADMIN_REFRESH_TOKEN],
  },
  async (event) => {
    const clientId = GOOGLE_ADMIN_CLIENT_ID.value();
    const clientSecret = GOOGLE_ADMIN_CLIENT_SECRET.value();
    const refreshToken = GOOGLE_ADMIN_REFRESH_TOKEN.value();
    const customerId = GOOGLE_ADMIN_CUSTOMER_ID.value() || "my_customer"; // default to my_customer if not explicitly set

    if (!clientId || !clientSecret || !refreshToken) {
      console.error("Missing Google Admin credentials.");
      return;
    }

    const authClient = await getGoogleAuthClient(clientId, clientSecret, refreshToken);
    const db = admin.firestore();
    const syncedSerials = new Set<string>();

    let pageToken = "";
    
    try {
      do {
        let url = `https://admin.googleapis.com/admin/directory/v1/customer/${customerId}/devices/chromeos?projection=FULL&maxResults=200`;
        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }

        const res = await authClient.request({ url });
        const data = res.data as { chromeosdevices?: GoogleChromeDevice[], nextPageToken?: string };
        const devices = data.chromeosdevices || [];

        const batch = db.batch();

        for (const device of devices) {
          if (!device.serialNumber) continue;
          
          syncedSerials.add(device.serialNumber);

          // Data Minimization
          const publicData: FirestoreDevice = {
            Serial: device.serialNumber,
            DeviceID: device.deviceId,
            Model: device.model || "Unknown",
            LastCheckIn: device.lastPolicySync,
            DeviceType: "ChromeOS",
            AutoUpdateExpiration: device.autoUpdateExpiration || null,
            provisionStatus: device.status || "ACTIVE",
          };

          const piiData: FirestoreDevicePII = {
            Serial: device.serialNumber,
            DeviceName: device.orgUnitPath || "Unknown",
            // The recentUsers field contains an array of users who last logged into the Chromebook
            PrimaryUser: device.recentUsers && device.recentUsers.length > 0 ? device.recentUsers[0].email : "Unassigned"
          };

          // Update devices collection securely without overwriting manual data
          const deviceRef = db.collection("devices").doc(device.serialNumber);
          batch.set(deviceRef, publicData, { merge: true });

          const piiRef = db.collection("device_pii").doc(device.serialNumber);
          batch.set(piiRef, piiData, { merge: true });
        }

        await batch.commit();

        pageToken = data.nextPageToken || "";
      } while (pageToken);

      // --- Ghost Device Cleanup ---
      if (syncedSerials.size > 0) {
        console.log(`Successfully synced ${syncedSerials.size} ChromeOS devices from Google Admin.`);
        
        // Fetch all local ChromeOS devices
        const localChromeDevicesSnapshot = await db.collection("devices")
          .where("DeviceType", "==", "ChromeOS")
          .get();
        
        const deleteBatch = db.batch();
        let deleteCount = 0;

        for (const doc of localChromeDevicesSnapshot.docs) {
          const serial = doc.id;
          if (!syncedSerials.has(serial)) {
            // Device exists locally but not in Google Admin -> Delete ghost device
            deleteBatch.delete(doc.ref);
            deleteBatch.delete(db.collection("device_pii").doc(serial));
            deleteCount++;
          }
        }

        if (deleteCount > 0) {
          await deleteBatch.commit();
          console.log(`Deleted ${deleteCount} ghost ChromeOS devices.`);
        }
      }

      console.log("Google Admin sync completed successfully.");
    } catch (error) {
      console.error("Google Admin sync failed:", error);
    }
  }
);
