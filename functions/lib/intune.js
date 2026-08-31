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
exports.syncIntuneWindows = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const msal_node_1 = require("@azure/msal-node");
const INTUNE_CLIENT_ID = functions.params.defineSecret("INTUNE_CLIENT_ID");
const INTUNE_CLIENT_SECRET = functions.params.defineSecret("INTUNE_CLIENT_SECRET");
const INTUNE_TENANT_ID = functions.params.defineString("INTUNE_TENANT_ID");
// Helper to authenticate with MSAL
async function getGraphToken(clientId, clientSecret, tenantId) {
    const msalConfig = {
        auth: {
            clientId,
            authority: `https://login.microsoftonline.com/${tenantId}`,
            clientSecret,
        }
    };
    const cca = new msal_node_1.ConfidentialClientApplication(msalConfig);
    const clientCredentialRequest = {
        scopes: ["https://graph.microsoft.com/.default"],
    };
    try {
        const response = await cca.acquireTokenByClientCredential(clientCredentialRequest);
        return (response === null || response === void 0 ? void 0 : response.accessToken) || null;
    }
    catch (error) {
        console.error("Error acquiring MS Graph token:", error);
        return null;
    }
}
// The actual sync logic
exports.syncIntuneWindows = functions.scheduler.onSchedule({
    schedule: "every saturday 01:00",
    secrets: [INTUNE_CLIENT_ID, INTUNE_CLIENT_SECRET],
}, async (event) => {
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
            const devices = data.value || [];
            const batch = db.batch();
            for (const device of devices) {
                // Skip if missing critical identifiers
                if (!device.serialNumber)
                    continue;
                // Data Minimization
                const publicData = {
                    Serial: device.serialNumber,
                    DeviceID: device.id,
                    Model: device.model || "Unknown",
                    LastCheckIn: device.lastSyncDateTime,
                    DeviceType: "Windows",
                    provisionStatus: "ACTIVE"
                };
                const piiData = {
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
    }
    catch (error) {
        console.error("Intune sync failed:", error);
    }
});
//# sourceMappingURL=intune.js.map