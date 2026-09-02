# Laiterekisteri (Device Registry) - Final Documentation

Welcome to the **Laiterekisteri** project for Lappeenranta EDU. This application replaces legacy systems (Excel/Power Automate) with a modern, secure, and robust web application built for field workers and IT administrators.

---

## 🏗️ Architecture & Code Standards (@mikko-mentor & @kalle-coder)

The application is built with a strong emphasis on maintainability, type safety, and modern development practices.

- **Frontend Stack:** React 19, Vite, TypeScript (`strict: true`), React Router.
- **Backend Stack:** Firebase Cloud Functions (Node.js), Firestore (NoSQL).
- **Component Design:** Components are strictly typed and heavily documented. We utilize `// * How does this work?` educational comments throughout critical files (e.g., `App.tsx`, `DeviceList.tsx`, `intune.ts`) to ensure new developers can easily onboard.
- **Validation:** All inputs and external data are validated using **Zod** to prevent runtime errors and malicious injections.
- **Clean Code:** We follow the Single Responsibility Principle (SRP). UI logic is separated from backend interactions, and the codebase is sanitized regularly (`oxlint`) to remove unused variables and legacy files.

## 🔒 Security (@seppo-security)

Security is woven into the architecture from the ground up, following the **Principle of Least Privilege**.

- **Authentication:** Only `@edu.lappeenranta.fi` and `@lappee.fi` accounts can authenticate via Google/Microsoft SSO.
- **Role-Based Access Control (RBAC):** Access is strictly controlled via Firestore Security Rules (`firestore.rules`). 
  - **Global Admin:** Full system access.
  - **Admin:** Can read PII and perform specific updates.
  - **User:** Hard-restricted by routing and database rules to the Scanner view only. They cannot browse the global device inventory.
- **Secure Integrations:** Browser clients never communicate directly with Microsoft Graph API or Google Admin. All requests go through Firebase Cloud Functions which independently verify the user's Admin claims before taking action.
- **Secret Management:** OAuth tokens and API secrets are securely stored in Google Cloud Secret Manager, entirely inaccessible from the frontend.

## 🛡️ Privacy & GDPR (@timo-privacy)

Handling student and staff data requires absolute care. We prioritize **Data Minimization** and local processing.

- **Isolated PII:** Personally Identifiable Information (like user emails and device names) is completely separated from hardware data into a heavily restricted `device_pii` collection.
- **Local Camera Processing:** The device scanner (`html5-qrcode`) processes video feeds 100% locally in the browser. No video frames are ever transmitted to our servers or third parties.
- **Contextual Access:** Standard users are denied access to mass lists. They are only authorized to see non-PII details of a specific device *after* they have physically scanned it.

## 🎨 UX & UI Design (@ulla-ux-ui)

The interface is built to be fast, intuitive, and responsive for field workers using mobile devices.

- **Vibrant & Clean Aesthetics:** The UI features a glassmorphism aesthetic, subtle micro-animations, and modern typography (Inter/Roboto) to provide a premium feel over typical internal enterprise tools.
- **Frictionless Scanning:** The scanner is optimized for quick feedback with clear visual boundaries and error states.
- **Seamless Autocomplete:** When Admins reassign devices, the Azure AD user search utilizes debouncing to provide real-time, snappy suggestions without overloading the API.

---

## 🚀 Getting Started (Development)

1. **Install Dependencies:**
   ```bash
   npm install
   cd functions && npm install
   ```

2. **Run the Local Environment (HTTPS required for camera):**
   ```bash
   npm run dev
   ```

3. **Firebase Emulators (Backend):**
   Development must happen against local emulators to protect production data.
   ```bash
   cd functions && npm run serve
   ```

*Documentation reviewed and approved by the Laiterekisteri Agent Team.*
