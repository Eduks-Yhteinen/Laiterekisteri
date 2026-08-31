================================================================================
DOCUMENTATION: TODAY_AND (ANDROID MASTER FILE SYNC) FLOW
================================================================================

OVERALL LOGIC "THE BIG IDEA":
This flow is a back-end data maintenance utility. It bridges the gap between 
real-time SharePoint list entries and the static "Master_NEW.json" source file 
used for Android device auditing. It detects new devices that aren't in the 
master file yet and appends them to ensure your "Source of Truth" is complete.

--------------------------------------------------------------------------------
COMPONENT BREAKDOWN & PURPOSE
--------------------------------------------------------------------------------

1. TRIGGER: RECURRENCE (Daily)
   - FUNCTION: Triggers automatically once every 24 hours.
   - WHY: Ensures that any Android devices added during daily operations are 
     captured and locked into the master data file by the following day.

2. GET NEW DATA (SharePoint List)
   - FUNCTION: Pulls the latest entries from the Android registration list.
   - WHY: Acts as the "Ingest" point for new hardware data that hasn't been 
     recorded in the permanent JSON file yet.

3. GET MASTER DATA (JSON File)
   - FUNCTION: Downloads the existing 'Master_Android/Master_NEW.json'.
   - WHY: Retrieves the current list of known devices to use as a baseline 
     for comparison.

4. SELECT & FILTER ARRAY (The "Delta" Check)
   - FUNCTION: 
     - "Select" maps out key fields (Serial, Device ID, IMEI, User Email).
     - "Filter_array" compares the new list against the old file.
   - WHY: It prevents data bloat by identifying only the specific serial 
     numbers that do NOT already exist in the master file.

5. DATA ASSEMBLY (Variables & Loops)
   - FUNCTION: 
     - Initializes 'MasterDeviceList' with the currently known data.
     - "Apply_to_each" appends the verified new devices to that list.
   - WHY: Reconstructs a single, unified database in the flow's memory.

6. UPDATE FILE (SharePoint Overwrite)
   - FUNCTION: Uploads the updated 'MasterDeviceList' back to the SharePoint 
     folder, replacing the old 'Master_NEW.json'.
   - WHY: Finalizes the sync, ensuring that the next time an "End of Life" 
     audit runs, it has the most complete and up-to-date Android device list.

--------------------------------------------------------------------------------
TECHNICAL SPECIFICATIONS
--------------------------------------------------------------------------------
SHAREPOINT SITE: https://lappeefi.sharepoint.com/sites/Laiterekisteri
MASTER FILE:     /Shared Documents/Master_Android/Master_NEW.json
NEW DATA TABLE:  91a5da85-9d80-4c38-9747-4ad28ed2555a
KEY FIELDS:      Serial Number, Device ID, IMEI, Primary User Email

--------------------------------------------------------------------------------
CRITICAL NOTES FOR HUMANS:
--------------------------------------------------------------------------------
- This flow maintains the "Engine" (the JSON file) that other flows rely on.
- It maps more technical fields than the iOS version, specifically capturing 
  IMEI and Device IDs which are critical for Android troubleshooting.
================================================================================