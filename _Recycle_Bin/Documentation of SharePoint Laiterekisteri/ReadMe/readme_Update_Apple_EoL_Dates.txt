================================================================================
DOCUMENTATION: Update Apple EoL Dates
OVERALL LOGIC "THE BIG IDEA":
This workflow automates the tracking and updating of Apple iOS and iPadOS devices that have reached End of Life (EoL) or become inactive. It queries Microsoft Intune for enrolled devices in bulk, fetches detailed hardware models, cross-references them against a predefined list of obsolete models, backs up the existing master inventory JSON, cleans the data, updates the SharePoint inventory list, cleans out stale entries, and flags devices that are functionally outdated or have not checked in for over 30 days. This version focuses heavily on in-memory data processing to reduce redundant SharePoint API calls.
================================================================================
COMPONENT BREAKDOWN & PURPOSE:
Recurrence
FUNCTION: Triggers the workflow automatically every week.
WHY: Keeps EoL data consistently updated without manual intervention.
---------------------------------------------------------------------------
vanhat_mallit
FUNCTION: Initializes an array variable with a hardcoded list of obsolete Apple device models.
WHY: Centralizes the list of old models so it can be easily referenced during the evaluation phase.
---------------------------------------------------------------------------
Prep_new_master
FUNCTION: Makes a bulk HTTP GET request to the Intune Graph API for all iOS and iPadOS devices, requesting userPrincipalName.
WHY: Optimizes network calls and gathers device owner information in the primary query.
---------------------------------------------------------------------------
Parse_JSON_from_Endpoint
FUNCTION: Parses the raw JSON response from the bulk Intune API call.
WHY: Translates raw data into usable dynamic content tokens for the rest of the flow.
---------------------------------------------------------------------------
Array_for_productid
FUNCTION: Initializes an empty array variable named Masterarray.
WHY: Provides a temporary staging area to compile the newly updated master device list in memory.
---------------------------------------------------------------------------
Go_through_serial
FUNCTION: Loops through the parsed Intune devices, fetches specific hardware model data via Graph API, and appends the combined data to Masterarray.
WHY: Detailed hardware information requires a specific API call per device ID, which is then compiled for the master record.
---------------------------------------------------------------------------
Get_master_to_backup
FUNCTION: Retrieves the current contents of Master_Apple.json from SharePoint.
WHY: Prepares the existing dataset to be safely backed up before overwriting it with new data.
---------------------------------------------------------------------------
Backup_old_master
FUNCTION: Creates a new file in SharePoint with a timestamped filename containing the old master JSON data.
WHY: Ensures data recovery is possible if the pipeline fails or data is corrupted during update.
---------------------------------------------------------------------------
Select_mastervalues
FUNCTION: Reshapes the Masterarray in memory by selecting specific fields and explicitly omitting the Primary User field for the master file.
WHY: Prepares a clean data structure to be saved to SharePoint without unnecessary or sensitive user context in the raw file.
---------------------------------------------------------------------------
Update_master
FUNCTION: Overwrites the Master_Apple.json file in SharePoint with the output from Select_mastervalues.
WHY: Sets the newly compiled and shaped device list as the current source of truth in SharePoint.
---------------------------------------------------------------------------
Filter_Bad_Data
FUNCTION: Evaluates the in-memory Masterarray to include devices with an OS version of 16 or lower, OR devices that have not checked in within the last 30 days.
WHY: Bypasses the need to re-download and parse the saved JSON file, greatly speeding up the flow while identifying actionable hardware.
---------------------------------------------------------------------------
Get_iOS_EOL_list_to_clean
FUNCTION: Retrieves all existing items from the SharePoint EoL tracker list.
WHY: Identifies old records that need to be purged before the new sync.
---------------------------------------------------------------------------
Apply_to_each
FUNCTION: Loops through the existing SharePoint EoL list and deletes each item.
WHY: Resets the SharePoint list to ensure no ghost devices remain from previous runs.
---------------------------------------------------------------------------
Apply_to_each_1
FUNCTION: Loops through the filtered device data and creates or updates SharePoint records, mapping LastConnected and UPN fields.
WHY: Populates the clean SharePoint tracker with the most current EoL and stale device information.
---------------------------------------------------------------------------
Get_items_from_iOS_EOL
FUNCTION: Retrieves the newly populated list of devices from SharePoint.
WHY: Gathers the final list of devices to prepare for the tagging phase.
---------------------------------------------------------------------------
Loop_Through_Matched_Devices
FUNCTION: Evaluates each device and updates the OldModel field to Yes if it matches the vanhat_mallit list.
WHY: Completes the EoL identification by actively flagging the obsolete hardware in the final report.
================================================================================
TECHNICAL SPECIFICATIONS
Trigger: Weekly Scheduled Recurrence (Timezone: FLE Standard Time)
Primary APIs Used: Microsoft Graph API (beta) for deviceManagement
Authentication: ActiveDirectoryOAuth
Storage Destination: SharePoint Online (Laiterekisteri site)
Data Formats: JSON arrays and objects
================================================================================
CRITICAL NOTES FOR HUMANS:
- VERSION 1.0 TO 2.0 CHANGELOG:
- Moved vanhat_mallit from a local Compose action to a global root-level Initialize Variable action.
- Heavily optimized Intune Graph API calls via single bulk fetch (Prep_new_master).
- Implemented a robust data backup strategy (Get_master_to_backup and Backup_old_master).
- Streamlined Schema.
- VERSION 2.0 TO 3.0 CHANGELOG:
- Expanded Definition of Actionable Devices: Filter_Bad_Data now flags devices that have not checked in for over 30 days.
- Added User Principal Name (UPN) Tracking.
- Handled Unassigned Devices: Injected 'NoUser' if userPrincipalName is empty.
- Updated SharePoint Mapping: Pushed 'LastConnected' and 'UPN' fields to the SharePoint tracker.
- VERSION 3.0 TO 4.0 CHANGELOG:
- Eliminated Redundant File Operations: Removed Get_file_content, The_Debugger, and Parse_Master_JSON steps.
- In-Memory Processing: Filter_Bad_Data now processes data directly from the Masterarray variable instead of re-downloading the SharePoint JSON, massively improving performance.
- Pre-Save Data Shaping: Introduced Select_mastervalues to strip out the 'Primary User' field before writing the Masterarray to the backup file in Update_master.
================================================================================