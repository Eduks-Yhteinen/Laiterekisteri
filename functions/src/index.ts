import * as admin from "firebase-admin";
// Trigger redeploy for .env update

admin.initializeApp();

export * from "./intune";
export * from "./googleAdmin";

