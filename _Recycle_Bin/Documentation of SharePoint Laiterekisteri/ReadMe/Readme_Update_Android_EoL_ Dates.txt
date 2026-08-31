================================================================================
DOCUMENTATION: Update Android EoL Dates
OVERALL LOGIC "THE BIG IDEA":
This flow runs weekly to maintain an accurate inventory of End-of-Life and inactive Android devices. It fetches the current managed device list from Microsoft Intune via Graph API, backs up the existing master JSON inventory in SharePoint, and overwrites it with fresh data. It then filters this master data for legacy Samsung models or devices that have not synced in 30 days, wipes the existing SharePoint tracking list clean, and populates it with the filtered results to ensure data integrity.
================================================================================
COMPONENT BREAKDOWN & PURPOSE:
Recurrence
FUNCTION: Triggers the flow automatically every week on FLE Standard Time.
WHY: Ensures the tracking data is refreshed regularly without manual input.
---------------------------------------------------------------------------
vanhat_mallit
FUNCTION: Initializes an array containing specific legacy Samsung model codes.
WHY: Serves as the reference list to identify which models are End-of-Life.
---------------------------------------------------------------------------
Prep_new_master
FUNCTION: Calls the Microsoft Graph API beta endpoint to get managed devices.
WHY: Retrieves live data for all Android-based devices currently in Intune.
---------------------------------------------------------------------------
Parse_JSON_from_Endpoint
FUNCTION: Converts the Graph API HTTP response into a structured JSON object.
WHY: Allows the flow to access specific device properties like Serial and Model.
---------------------------------------------------------------------------
Initialize_variable
FUNCTION: Prepares an empty Masterarray variable to store processed data.
WHY: Acts as a staging area for the updated inventory before saving to a file.
---------------------------------------------------------------------------
Go_through_serial
FUNCTION: Iterates through the parsed Intune data to build the Masterarray.
WHY: Reformats the raw API data into a clean structure for the master file.
---------------------------------------------------------------------------
Get_master_to_backup
FUNCTION: Retrieves the current Master_Android.json file from SharePoint.
WHY: Obtains the existing state of the inventory before it is overwritten.
---------------------------------------------------------------------------
Backup_old_master
FUNCTION: Saves the retrieved master file with a unique timestamped filename.
WHY: Provides a recovery point and historical record of the inventory state.
---------------------------------------------------------------------------
Select_mastervalues
FUNCTION: Filters the Masterarray to include only the required data columns.
WHY: Prepares a clean, minimized dataset for the updated master JSON file.
---------------------------------------------------------------------------
Update_master
FUNCTION: Overwrites the Master_Android.json file with the newly fetched data.
WHY: Keeps the central inventory file current with the latest Intune records.
---------------------------------------------------------------------------
Filter_Bad_Data
FUNCTION: Filters Masterarray for legacy models or devices inactive for 30 days.
WHY: Isolates only the specific devices that need to be tracked in the list.
---------------------------------------------------------------------------
Get_old_data
FUNCTION: Retrieves all current items from the SharePoint EoL tracking list.
WHY: Identifies all existing records so they can be purged.
---------------------------------------------------------------------------
Wipe_old_data
FUNCTION: Iterates through and deletes every item found in the SharePoint list.
WHY: Clears the list to prevent duplicate entries and remove resolved items.
---------------------------------------------------------------------------
Apply_to_each
FUNCTION: Iterates through the filtered EoL data.
WHY: Allows individual processing of each flagged device.
---------------------------------------------------------------------------
Evaluate_UPN
FUNCTION: Checks if the user principal name is empty and substitutes NoUser.
WHY: Prevents item creation failures due to missing mandatory user data.
---------------------------------------------------------------------------
Create_item
FUNCTION: Generates new list items for the filtered devices.
WHY: Populates the clean SharePoint list with the latest identified EoL devices.
================================================================================
TECHNICAL SPECIFICATIONS
Trigger: Weekly Recurrence (FLE Standard Time)
Source Site: https://lappeefi.sharepoint.com/sites/Laiterekisteri
Master File: /Shared Documents/Master_Android/Master_Android.json
SharePoint List ID: c739cddb-c516-4321-af25-72721a775502
Graph API: https://graph.microsoft.com/beta/deviceManagement/managedDevices
Authentication: Active Directory OAuth
Concurrency: Loops configured with a concurrency repetition of 50.
================================================================================
CRITICAL NOTES FOR HUMANS:
- The array of legacy models is hardcoded and requires manual updates.
- The flow performs a destructive wipe of the tracking list before writing.
- Graph API App Registration token expiration will cause flow failures.
================================================================================
VERSION HISTORY:
- Overhauled architecture: Flow now queries Intune globally first, updates the master JSON, then filters for SharePoint, replacing the per-device Intune query logic.
- Added backup mechanism to save historical snapshots of the master JSON file.
- Expanded filter criteria to track devices that have not synced in over 30 days.
- Added UPN validation to replace empty user values with a default string.
================================================================================