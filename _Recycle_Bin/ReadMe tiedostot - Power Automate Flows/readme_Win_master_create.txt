================================================================================
DOCUMENTATION: WINDOWS ENDPOINT & BILLING MERGE (VERSION 2.2)
OVERALL LOGIC "THE BIG IDEA":
This flow is a highly optimized data aggregation tool[cite: 2].
It combines live hardware and telemetry data from Microsoft Intune (Endpoint) with financial and lease data stored in an Excel table[cite: 2].
It now incorporates a secondary Excel table to fetch specific Lease Type information[cite: 1].
To process thousands of devices efficiently, it avoids traditional loops using JSON dictionaries[cite: 2].
It identifies devices that exist ONLY in the localized Excel billing sheet, formats them to match the live data schema, and appends them to the final dataset[cite: 2].
This ensures a 100% comprehensive inventory report where no assets are left behind[cite: 2].
It replaced concat with union when merging the list[cite: 2].
================================================================================
COMPONENT BREAKDOWN & PURPOSE:
TRIGGER: RECURRENCE
FUNCTION: Runs automatically on a weekly basis on Saturday at 1:00 AM[cite: 1].
WHY: Generates a routine, up-to-date combined inventory and billing JSON report for data visualization or auditing[cite: 2].
---------------------------------------------------------------------------
HTTP_INTUNE
FUNCTION: Queries Microsoft Graph API to fetch the current device fleet with an OData filter for Windows OS and pagination enabled[cite: 1, 2].
WHY: Retrieves the master list of active Windows devices while bypassing the default API limit[cite: 2].
---------------------------------------------------------------------------
LIST_ROWS_PRESENT_IN_A_TABLE
FUNCTION: Fetches all rows from the primary financial/lease Excel table using built-in pagination[cite: 1, 2].
WHY: Pulls the localized billing data to be cross-referenced against live Intune data[cite: 2].
---------------------------------------------------------------------------
LIST_ROWS_PRESENT_IN_A_TABLE_1
FUNCTION: Fetches rows from the laiterekisteri_leasingtyyppi.xlsx table[cite: 1].
WHY: Retrieves additional specific leasing type data for the devices[cite: 1].
---------------------------------------------------------------------------
FORMAT_LEASING_EXCEL
FUNCTION: Transforms the flat leasing Excel array into distinct JSON objects keyed by Serial[cite: 1].
WHY: Prepares the leasing data for dictionary conversion[cite: 1].
---------------------------------------------------------------------------
LEASING_DICTIONARY
FUNCTION: Converts the formatted leasing Excel objects into a single JSON Object[cite: 1].
WHY: Enables instant lookup of lease types by serial number without looping[cite: 1].
---------------------------------------------------------------------------
FORMAT_EXCEL
FUNCTION: Transforms the flat Excel array into distinct JSON objects where the Intune Serial Number is set as the Master Key[cite: 2].
WHY: Prepares the flat table data for dictionary conversion ensuring a unique identifier to link datasets[cite: 2].
---------------------------------------------------------------------------
EXCEL_DICTIONARY
FUNCTION: Uses string manipulation to glue the formatted Excel objects into one single JSON Object[cite: 2].
WHY: Turns Excel data into a Dictionary for instant lookup, saving compute time[cite: 2].
---------------------------------------------------------------------------
SELECT
FUNCTION: Loops through the Intune array and constructs the primary dataset injecting Excel and Leasing Dictionary data[cite: 1, 2].
WHY: Creates the finalized data structure for active devices and handles missing values safely[cite: 2].
---------------------------------------------------------------------------
SELECT_INTUNE_SERIALS
FUNCTION: Extracts a flat string array of just the Serial Numbers from the live Intune HTTP response[cite: 2].
WHY: Creates a highly efficient reference list required to identify missing devices[cite: 2].
---------------------------------------------------------------------------
FILTER_ARRAY
FUNCTION: Scans the Excel array against the flat Intune Serials array to keep only rows that do not contain a match[cite: 1, 2].
WHY: Isolates the Excel-only devices that are unmanaged or missing from the Intune tenant[cite: 2].
---------------------------------------------------------------------------
SELECT_FORMAT_EXCEL_ONLY
FUNCTION: Molds the isolated Excel-only devices into the exact same JSON structure as the Main Select Array, pulling LeaseType from the Leasing Dictionary[cite: 1, 2].
WHY: Ensures the two disparate datasets share a perfectly identical schema[cite: 2].
---------------------------------------------------------------------------
COMPOSE_COMBINE_LISTS
FUNCTION: Uses a union expression to glue the Main Select Array and the Select Format Excel Only array together[cite: 1, 2].
WHY: Merges the parallel branches producing a master list of all active and offline devices[cite: 2].
---------------------------------------------------------------------------
CREATE_FILE
FUNCTION: Takes the output from Compose Combine Lists and saves it as a single JSON file in SharePoint[cite: 1, 2].
WHY: Provides the localized data artifact for dashboards or auditing storage[cite: 2].
================================================================================
TECHNICAL SPECIFICATIONS
GRAPH ENDPOINT: https://graph.microsoft.com/v1.0/deviceManagement/managedDevices[cite: 1, 2]
GRAPH FILTER: $filter=operatingSystem eq 'Windows'[cite: 1, 2]
TIMEZONE: FLE Standard Time (dd.MM.yyyy HH:mm format)[cite: 1, 2]
PAGINATION: Enabled on both HTTP and Excel actions[cite: 1, 2]
PRIMARY KEY: Intune 'serialNumber' == Excel 'Laitteen sarjanumero'[cite: 1, 2]
ARRAY MERGE: union(body('Select'), body('Select_Format_Excel_Only'))[cite: 1, 2]
================================================================================
CRITICAL NOTES FOR HUMANS:
- FILE OVERWRITE (CHUNKING): The Create file action has Allow Chunking turned OFF[cite: 2].
This allows the flow to cleanly replace the master JSON file every run[cite: 2].
- EXCEL ACTION NAMES: The Excel Dictionary step relies heavily on the exact name of the Excel action[cite: 2].
If the step is renamed, the string manipulation formulas must be updated[cite: 2].
- SCHEMA SYMMETRY: If you add a new data column to the Main Select Array, you MUST also add that exact same column name to the Select Format Excel Only action[cite: 2].
If schemas do not match, downstream applications will fail to parse the JSON[cite: 2].
- DATE SERIALIZATION: Excel stores dates as integers[cite: 2].
The flow uses an addDays expression starting from 1899-12-30 to recalculate dates[cite: 2].
If the addDays math attempts to process a blank cell, the flow will fail, so expressions use nested if(empty) checks[cite: 2].
- NEW DESIGNER EXPRESSIONS: Dynamic expressions must be entered via the fx formula button WITHOUT the @ symbol in modern designer[cite: 2].
================================================================================