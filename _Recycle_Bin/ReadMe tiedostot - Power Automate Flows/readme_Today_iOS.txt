================================================================================
DOCUMENTATION: TODAY_iOS MASTER FILE SYNC FLOW
================================================================================

OVERALL LOGIC "THE BIG IDEA":
This flow is a data maintenance utility. It compares a SharePoint list of 
recently added iOS devices against the existing "Master_NEW.json" file. It 
identifies which devices are missing from the master file and appends them, 
ensuring the master JSON source remains up to date for all other flows.

--------------------------------------------------------------------------------
COMPONENT BREAKDOWN & PURPOSE
--------------------------------------------------------------------------------

1. TRIGGER: RECURRENCE (Daily)
   - FUNCTION: Triggers once every 24 hours.
   - WHY: Ensures that any new devices registered during the work day are 
     permanently added to the master file by the next morning.

2. GET NEW DATA (SharePoint List)
   - FUNCTION: Fetches the latest items from the iOS registration list.
   - WHY: This is the "Inbox" of new devices that haven't necessarily been 
     recorded in the master file yet.

3. GET MASTER DATA (JSON File)
   - FUNCTION: Downloads the current 'Master_NEW.json' file.
   - WHY: This represents the "Current State" of your registry. We need this 
     to compare against the new data to avoid duplicates.

4. SELECT & FILTER ARRAY (The Comparison)
   - FUNCTION: 
     - "Select" creates a simplified list of just Serials and Models.
     - "Filter_array" checks the Master File and removes anything that 
       is already listed.
   - WHY: This identifies the "Delta"—only the brand-new devices that 
     actually need to be added.

5. MASTER LIST ASSEMBLY (Variables & Loops)
   - FUNCTION: 
     - Sets a variable 'MasterDeviceList' with the filtered existing items.
     - "Apply_to_each" appends the new devices to that same variable.
   - WHY: It builds a single, complete array in memory that combines the 
     old verified data with the new verified entries.

6. UPDATE FILE (SharePoint Update)
   - FUNCTION: Overwrites the old 'Master_NEW.json' with the newly 
     assembled 'MasterDeviceList'.
   - WHY: This completes the sync cycle, making the new devices part of the 
     official master record for future automation runs.

--------------------------------------------------------------------------------
TECHNICAL SPECIFICATIONS
--------------------------------------------------------------------------------
SHAREPOINT SITE: https://lappeefi.sharepoint.com/sites/Laiterekisteri
MASTER FILE:     /Shared Documents/Master_iOS/Master_NEW.json
NEW DATA TABLE:  6c33bc5a-885e-4904-80a0-ac3275bd3454
KEY FIELDS:      Serial Number, Model, Enrollment Date

--------------------------------------------------------------------------------
CRITICAL NOTE FOR HUMANS:
--------------------------------------------------------------------------------
- This flow does NOT update a visible dashboard; it updates a BACKGROUND file.
- If the "Master_NEW.json" file is ever deleted, this flow will fail because 
  it cannot find the "Current State" to compare against.
================================================================================