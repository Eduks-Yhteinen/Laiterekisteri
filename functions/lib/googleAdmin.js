"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncGoogleChrome = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const GOOGLE_ADMIN_CLIENT_ID = functions.params.defineSecret("GOOGLE_ADMIN_CLIENT_ID");
const GOOGLE_ADMIN_CLIENT_SECRET = functions.params.defineSecret("GOOGLE_ADMIN_CLIENT_SECRET");
const GOOGLE_ADMIN_REFRESH_TOKEN = functions.params.defineSecret("GOOGLE_ADMIN_REFRESH_TOKEN");
const GOOGLE_ADMIN_CUSTOMER_ID = functions.params.defineString("GOOGLE_ADMIN_CUSTOMER_ID");
// Helper to authenticate with Google API
async function getGoogleAuthClient(clientId, clientSecret, refreshToken) {
    const oAuth2Client = new google_auth_library_1.OAuth2Client(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    return oAuth2Client;
}
exports.syncGoogleChrome = functions.scheduler.onSchedule({
    schedule: "every saturday 02:00",
    secrets: [GOOGLE_ADMIN_CLIENT_ID, GOOGLE_ADMIN_CLIENT_SECRET, GOOGLE_ADMIN_REFRESH_TOKEN],
}, async (event) => {
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
    let pageToken = "";
    try {
        do {
            let url = `https://admin.googleapis.com/admin/directory/v1/customer/${customerId}/devices/chromeos?projection=FULL&maxResults=200`;
            if (pageToken) {
                url += `&pageToken=${pageToken}`;
            }
            const res = await authClient.request({ url });
            const data = res.data;
            const devices = data.chromeosdevices || [];
            const batch = db.batch();
            for (const device of devices) {
                if (!device.serialNumber)
                    continue;
                // Data Minimization
                const publicData = {
                    Serial: device.serialNumber,
                    DeviceID: device.deviceId,
                    Model: device.model || "Unknown",
                    LastCheckIn: device.lastPolicySync,
                    DeviceType: "ChromeOS",
                    AutoUpdateExpiration: device.autoUpdateExpiration || null,
                    provisionStatus: device.status || "ACTIVE",
                };
                const piiData = {
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
        console.log("Google Admin sync completed successfully.");
    }
    catch (error) {
        console.error("Google Admin sync failed:", error);
    }
});
//# sourceMappingURL=googleAdmin.js.map