================================================================================
DOCUMENTATION: Chromebook_master_create
OVERALL LOGIC "THE BIG IDEA":
Automates the synchronization of Google Admin SDK device data with Excel-based
ledger records to create a master inventory file (Master_Chrome.json).
The flow avoids heavy "Apply to Each" loops by using direct expressions and
pagination to handle large datasets (5,000+ rows) without hitting memory limits.
================================================================================
COMPONENT BREAKDOWN & PURPOSE:
Recurrence
FUNCTION: Scheduled trigger that runs with a frequency of 1 Month, starting from 2026-03-29T07:00:00.000Z.
WHY: Ensures the master inventory is updated on a consistent, periodic basis without requiring manual administrator intervention.
---------------------------------------------------------------------------
Get_Token & Bucket/Bookmark Variable Initialization
FUNCTION: Authenticates via POST to oauth2.googleapis.com using a refresh_token and client_id (831308198442...). Initializes 'DeviceList' array and 'PageToken' string.
WHY: Securely establishes the OAuth2 Bearer token and prepares the required variable structures to hold the paginated Google Admin data.
---------------------------------------------------------------------------
Do_until (Connect_Google & Apply_to_each)
FUNCTION: Loops GET requests to admin.googleapis.com (projection=FULL&maxResults=200) until 'PageToken' equals 'STOP'. Appends 'chromeosdevices' to 'DeviceList'. Limited to 5000 iterations or a 1-hour timeout (PT1H).
WHY: Acts as the primary source for real-time hardware status, bypassing standard HTTP connector limitations by explicitly handling Google API pagination parameters.
---------------------------------------------------------------------------
List_rows_present_in_a_table
FUNCTION: Queries table {DEEC8F48-82EB-4E77-9F9E-4A065A576378} located at /Master_Chrome/Chromebook_laskut/chrome_laskut.xlsx on lappeefi.sharepoint.com. PaginationPolicy minimumItemCount is set to 5000.
WHY: Retrieves receipt metadata (LaskuID, Toimituspvm) from the financial ledger to enrich the hardware data in a single API call capable of handling high volumes.
---------------------------------------------------------------------------
Select_Chromebook_Serials & Filter_array
FUNCTION: Extracts 'serialNumber' from 'DeviceList' into a flat array. Then filters the Excel table output where the Excel 'serial' is NOT contained in the extracted Google serials array.
WHY: Identifies devices present in the financial ledger that are not yet enrolled in the Google Admin console, specifically targeting purchased but unenrolled hardware.
---------------------------------------------------------------------------
Select (Data Mapping) & Format_Excel
FUNCTION: Maps 'DeviceList' attributes (deviceId, model, osVersion, orgUnitPath) and uses first() to grab Excel data (kuitin_nimi, LaskuID). Uses trim/replace/decodeUriComponent('%C2%A0') to clean serials. Formats 'autoUpdateExpiration' using addSeconds from 1970-01-01 and 'Toimituspvm' using addDays from 1899-12-30.
WHY: Prevents auto-looping while efficiently mapping complex JSON structures, sanitizing whitespace/non-breaking spaces, and accurately converting Unix/Excel epoch timestamps into ISO 8601 strings.
---------------------------------------------------------------------------
Compose_Combine_Lists
FUNCTION: Performs a union() expression to merge the body('Select') mapped data and the body('Select_Format_Excel_Only') unenrolled records.
WHY: Consolidates all relevant hardware and financial data into a single, comprehensive array to create the definitive JSON payload.
---------------------------------------------------------------------------
Create_file
FUNCTION: Saves the final composed JSON array to the Laiterekisteri SharePoint dataset at folderPath /Shared Documents/Master_Chrome with the name Master_Chrome.json.
WHY: Provides a stable production endpoint for downstream apps and reporting tools to securely consume the synchronized dataset.
================================================================================
TECHNICAL SPECIFICATIONS
- Environment: Power Automate (Logic Flow)
- Connections: Excel Online Business, Google Admin API (HTTP), SharePoint
- Memory Limit Fix: Pagination enabled; replaced loops with body/value[0] logic
- Date Handling: Converts Excel serials (1899-12-30 base) and Unix Epochs (1970-01-01 base) to ISO 8601 (yyyy-MM-dd)
- Data Limit: Configured for payloads up to 200MB / 5,120 rows
- Authentication: OAuth2 Refresh Token flow for Google Admin SDK (Chunked Transfer)
- Data Cleansing: Uses decodeUriComponent('%C2%A0') to remove non-breaking spaces
================================================================================
CRITICAL NOTES FOR HUMANS:
- PERFORMANCE: Use minified JSON for production; use "testi" version for debug.
- STABILITY: If "Index Out of Bounds" occurs, verify the Excel table is not empty.
- FORMATTING: Excel date columns must be read as ISO 8601 strings in the connector.
================================================================================
VERSION HISTORY:
- 1.0.0 (2026-03-29): Initial setup with iterative loops.
- 1.1.0 (2026-05-01): Optimization; resolved 200MB loop buffer crash.
- 1.2.0 (2026-05-08): Fixed Excel Date Serial bug and implemented first() logic.
================================================================================