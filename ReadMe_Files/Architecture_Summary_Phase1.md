# Laiterekisteri - Backend Architecture Summary

## What Was Built
Today, we successfully migrated the legacy Microsoft Power Automate flows into a modern, code-driven backend utilizing Firebase Cloud Functions (Node.js & TypeScript).

### 1. API Integrations
- **Microsoft Intune:** Implemented `@azure/msal-node` to authenticate and fetch paginated Windows device data from the Microsoft Graph API.
- **Google Workspace:** Implemented `google-auth-library` to authenticate and fetch paginated ChromeOS device data from the Google Admin SDK.

### 2. Synchronized Syncing Logic
- Replaced the fragile Excel-based logic with a robust NoSQL approach using Cloud Firestore.
- Scheduled tasks (`syncIntuneWindows` and `syncGoogleChrome`) run automatically to pull device lists.
- Data is written using a non-destructive merge (`merge: true`), utilizing the hardware Serial Number as the primary key. This ensures automated API updates seamlessly enrich the database without erasing manual inputs (like Lease End dates or PO numbers).

## Security & Privacy (By Design)
- **Zero-Trust Secrets:** All OAuth client IDs, secrets, and refresh tokens were removed from source code and environment variables, and are now stored securely in Google Cloud Secret Manager.
- **Data Minimization (GDPR):** The backend strictly splits API payloads. Public hardware specs are routed to the `devices` collection, while sensitive user assignments (Emails, Device Names) are isolated in the `device_pii` collection.

*Drafted by Olli (Architect)*
