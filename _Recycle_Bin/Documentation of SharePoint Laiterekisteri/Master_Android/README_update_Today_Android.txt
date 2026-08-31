================================================================================
PROJECT: Laiterekisteri Automation (Android Intune JSON Parsing & Hybrid Mapping)
DATE:    March 10, 2026
STATUS:  SCHEMA OPTIMIZED / HYBRID MAPPING READY
================================================================================

1. OVERVIEW
--------------------------------------------------------------------------------
The objective is to parse Android-specific JSON exports from Intune and merge them with existing SharePoint asset data (`Get_Original_Item`). This creates a standardized, 11-column payload that combines live hardware telemetry with internal lifecycle and billing information.

2. ARCHITECTURE & DATA FLOW
--------------------------------------------------------------------------------
[Raw Android JSON] -> [Parse JSON (Relaxed Schema)] -> [Get_Original_Item (SP)] -> [Data Mapping] -> [Consolidated Payload]

A. PAYLOAD MAPPING (INTUNE TELEMETRY)
- Internal_ID   <- 'Device ID'
- Serial        <- 'Serial number'
- IMEI          <- 'IMEI'
- Model         <- 'Universal model name' (Prioritized over raw 'Model' for readability)
- OS            <- 'OS version'
- Last Checkin  <- 'Last check-in'

B. PAYLOAD MAPPING (SHAREPOINT LIFECYCLE DATA)
- KP            <- 'Kustannuspaikka'
- VuokraPVM     <- 'VuokraPVM'
- Laitteen Tila <- 'DeviceStatus'
- Lasku         <- 'Lasku'

C. HYBRID FALLBACK LOGIC
- OstoPVM       <- Checks SharePoint 'OstoPVM'. If empty/null, falls back to Intune 'Enrollment date'.

3. KEY ISSUES RESOLVED
--------------------------------------------------------------------------------
- Mixed Data Type Failures: Intune's Android export frequently mixes strings, raw integers (e.g., OS version, IMEI), and blank values (e.g., Phone number). Implemented an "Any-Type" schema (using empty brackets `{}`) to bypass strict type validation while keeping dynamic content tags intact.
- Missing Purchase Dates: Created an `if(empty(...))` expression to ensure the 'OstoPVM' field always has a value, using the device's initial Intune enrollment date as a reliable fallback.
- Readability of Android Models: Switched the Model mapping from the technical 'Model' field (e.g., SM-A325F) to the 'Universal model name' field (e.g., Samsung Galaxy A32) for cleaner reporting.

4. CURRENT STATE
--------------------------------------------------------------------------------
The Android Parse JSON action is now resilient against Intune's inconsistent data types. The mapping step successfully bridges data between the live MDM environment and the static SharePoint database.

5. NEXT STEPS
--------------------------------------------------------------------------------
- Verify that the internal column names used in the `Get_Original_Item` expressions (like 'OstoPVM' and 'Lasku') perfectly match the system names in the SharePoint list settings.
- Run a test iteration to confirm the 'OstoPVM' fallback logic triggers correctly on an item missing a purchase date.

================================================================================