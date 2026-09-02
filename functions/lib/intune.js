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
exports.searchIntuneUsers = exports.updateIntuneDevice = exports.syncIntuneWindows = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const msal_node_1 = require("@azure/msal-node");
const INTUNE_CLIENT_ID = functions.params.defineSecret("INTUNE_CLIENT_ID");
const INTUNE_CLIENT_SECRET = functions.params.defineSecret("INTUNE_CLIENT_SECRET");
const INTUNE_TENANT_ID = functions.params.defineSecret("INTUNE_TENANT_ID");
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
    schedule: "every 1 hours",
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
    const syncedSerials = new Set();
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
                syncedSerials.add(device.serialNumber);
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
        // --- Ghost Device Cleanup ---
        if (syncedSerials.size > 0) {
            console.log(`Successfully synced ${syncedSerials.size} Windows devices from Intune.`);
            // Fetch all local Windows devices
            const localWindowsDevicesSnapshot = await db.collection("devices")
                .where("DeviceType", "==", "Windows")
                .get();
            const deleteBatch = db.batch();
            let deleteCount = 0;
            for (const doc of localWindowsDevicesSnapshot.docs) {
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
                console.log(`Deleted ${deleteCount} ghost Windows devices.`);
            }
        }
        console.log("Intune sync completed successfully.");
    }
    catch (error) {
        console.error("Intune sync failed:", error);
    }
});
exports.updateIntuneDevice = functions.https.onCall({ secrets: [INTUNE_CLIENT_ID, INTUNE_CLIENT_SECRET, INTUNE_TENANT_ID] }, async (request) => {
    var _a;
    // 1. Authentication & Authorization
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    const email = request.auth.token.email || "";
    if (!email.endsWith("@edu.lappeenranta.fi") && !email.endsWith("@lappee.fi")) {
        throw new functions.https.HttpsError("permission-denied", "Unauthorized domain.");
    }
    const db = admin.firestore();
    // Check global admin
    const isGlobalAdmin = email === "pasi.hulkkonen@edu.lappeenranta.fi" || email === "joni.hikipaa@edu.lappeenranta.fi";
    let isAdmin = isGlobalAdmin;
    if (!isAdmin) {
        const roleDoc = await db.collection("user_roles").doc(request.auth.uid).get();
        isAdmin = (roleDoc.exists && ((_a = roleDoc.data()) === null || _a === void 0 ? void 0 : _a.role) === "admin") || email === "asentaja@lappee.fi";
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
    const patchBody = {};
    if (deviceName !== undefined)
        patchBody.deviceName = deviceName;
    if (primaryUser !== undefined)
        patchBody.userPrincipalName = primaryUser;
    if (Object.keys(patchBody).length === 0) {
        return { success: true, message: "No changes requested." };
    }
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
        batch.set(piiRef, Object.assign(Object.assign({}, (deviceName !== undefined && { DeviceName: deviceName })), (primaryUser !== undefined && { PrimaryUser: primaryUser })), { merge: true });
    }
    await batch.commit();
    return { success: true };
});
exports.searchIntuneUsers = functions.https.onCall({ secrets: [INTUNE_CLIENT_ID, INTUNE_CLIENT_SECRET, INTUNE_TENANT_ID] }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in");
    }
    const email = request.auth.token.email || "";
    if (!email.endsWith("@edu.lappeenranta.fi") && !email.endsWith("@lappee.fi")) {
        throw new functions.https.HttpsError("permission-denied", "Unauthorized domain.");
    }
    const db = admin.firestore();
    const isGlobalAdmin = email === "pasi.hulkkonen@edu.lappeenranta.fi" || email === "joni.hikipaa@edu.lappeenranta.fi";
    let isAdmin = isGlobalAdmin;
    if (!isAdmin) {
        const roleDoc = await db.collection("user_roles").doc(request.auth.uid).get();
        isAdmin = (roleDoc.exists && ((_a = roleDoc.data()) === null || _a === void 0 ? void 0 : _a.role) === "admin") || email === "asentaja@lappee.fi";
    }
    if (!isAdmin) {
        throw new functions.https.HttpsError("permission-denied", "Only Admins can search users.");
    }
    const { query } = request.data;
    if (!query || typeof query !== "string" || query.length < 3) {
        return { users: [] };
    }
    const clientId = INTUNE_CLIENT_ID.value();
    const clientSecret = INTUNE_CLIENT_SECRET.value();
    const tenantId = INTUNE_TENANT_ID.value();
    const token = await getGraphToken(clientId, clientSecret, tenantId);
    if (!token) {
        throw new functions.https.HttpsError("internal", "Failed to authenticate with MS Graph.");
    }
    const searchUrl = new URL('https://graph.microsoft.com/v1.0/users');
    // Sanitize query by removing quotes to prevent injection
    const sanitizedQuery = query.replace(/'/g, "");
    searchUrl.searchParams.append('$filter', `startswith(userPrincipalName,'${sanitizedQuery}') or startswith(displayName,'${sanitizedQuery}')`);
    searchUrl.searchParams.append('$select', 'displayName,userPrincipalName');
    searchUrl.searchParams.append('$top', '10');
    try {
        const res = await fetch(searchUrl.toString(), {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });
        if (!res.ok) {
            console.error("Intune GET users failed:", res.status, await res.text());
            throw new functions.https.HttpsError("internal", "Failed to fetch users from Intune.");
        }
        const data = await res.json();
        return {
            users: data.value.map((u) => ({
                displayName: u.displayName,
                email: u.userPrincipalName
            }))
        };
    }
    catch (e) {
        console.error("Error fetching Intune users:", e);
        throw new functions.https.HttpsError("internal", "Failed to fetch users from Intune.");
    }
});
//# sourceMappingURL=intune.js.map