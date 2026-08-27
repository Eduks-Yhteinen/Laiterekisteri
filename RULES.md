# Laiterekisteri – Global Rules (RULES.md)

This file defines the strict technical and architectural rules for the project[cite: 9]. All AI agents and developers MUST follow these without exception.

## 1. TECHNOLOGY STACK AND ENVIRONMENT
* **Stack:** Vite, React, TypeScript.
* **PROHIBITION:** The use of JavaScript (`.js`, `.jsx`) is strictly forbidden[cite: 9]. Produce ONLY pure TypeScript (`.ts`, `.tsx`).
* **Localhost First:** All code, development, and testing MUST ALWAYS be completed in a localhost environment[cite: 9]. Unfinished code is never pushed to production.
* **Emulators:** In localhost development, it is mandatory to use the Firebase Local Emulator Suite (or a separate Dev-Firebase project). Test data and production data must be strictly separated.
* **Secrets:** API keys, passwords, or sensitive configuration must never be hardcoded. Always use an `.env` file and ensure it is added to the `.gitignore` file.

## 2. CODE QUALITY AND ARCHITECTURE
* **File Size:** Recommended under 250 lines. The target maximum limit is 1000 lines.
* **SRP (Single Responsibility Principle):** One file/component handles only one responsibility.
* **Logic Isolation:** Keep UI components "dumb". Move business logic, data fetching, and state management to separate files (`hooks/`, `utils/`, `services/`).
* **Typing (Strict):** TypeScript `strict: true` is in effect. The use of the `any` type is STRICTLY FORBIDDEN.
* **Data Validation:** All incoming data and data saved to the database must be validated in a type-safe manner (e.g., with Zod schemas).

## 3. FIREBASE AND DATABASE
* **Database:** Firestore (NoSQL). Offline persistence (local storage) must be taken into account for field work.
* **RBAC (Role-Based Access Control):** Firestore rules must be defined so that only allowed emails and roles have read/write access. A user must never be able to access another user's data without admin privileges.
* **Hosting:** The primary platform is Firebase Hosting.

## 4. FILE NAMING CONVENTIONS
* **Project guidelines and reports (.md):** E.g., `RULES.md`, `PRIVACY.md`, `SECURITY.md`.
* **Firebase security rules (.rules):** `firestore.rules`, `storage.rules`.
* **Source code files (.ts, .tsx):**
  * React components: `PascalCase.tsx` (e.g., `DeviceScanner.tsx`).
  * Hooks: `camelCase.ts` with a `use` prefix (e.g., `useDevices.ts`).
  * Services and utilities: `camelCase.ts` (e.g., `firebaseService.ts`).
  * Types and schemas: `types.ts` and `schemas.ts`.