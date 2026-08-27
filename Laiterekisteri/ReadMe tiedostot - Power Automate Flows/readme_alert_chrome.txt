================================================================================
DOCUMENTATION: alert_Chrome
OVERALL LOGIC "THE BIG IDEA":
This flow automates the monitoring of ChromeOS devices by comparing a master inventory list against specific health and lifecycle criteria. It clears out previous alerts from a SharePoint list, identifies active devices that are either approaching their Auto Update Expiration (AUE) within 30 days or have not synced policies in over 30 days, fetches the most recent user data from the Google Admin API, and logs these exceptions for administrative action.
================================================================================
COMPONENT BREAKDOWN & PURPOSE:
manual
FUNCTION: Manually triggered button.
WHY: Allows administrators to initiate the audit and alert generation process on demand.
---------------------------------------------------------------------------
Get_master
FUNCTION: Retrieves the Master_Chrome.json file from SharePoint Online.
WHY: Acts as the primary source of truth for the current ChromeOS fleet inventory.
---------------------------------------------------------------------------
Select_values
FUNCTION: Parses the JSON content from the master file using a defined schema.
WHY: Converts raw file content into structured data objects (Serial Number, Model, OS Version, etc.) that the flow can manipulate.
---------------------------------------------------------------------------
Convert_values
FUNCTION: Formats and cleans dates for AUE, Last Sync, Enrollment, and Recent Activity.
WHY: Normalizes inconsistent date formats (handling both ISO strings and Excel serial dates starting from 1899-12-30) to ensure reliable comparisons.
---------------------------------------------------------------------------
Get_alert_chrome_to_clean
FUNCTION: Fetches all existing items from the SharePoint Alert list.
WHY: Identifies old alert data that needs to be removed to prevent duplication and ensure the new report is accurate.
---------------------------------------------------------------------------
Apply_to_each
FUNCTION: Loops through existing SharePoint alerts.
WHY: Provides a clean slate for the new audit results; runs with a concurrency of 50 for high-speed processing.
---------------------------------------------------------------------------
Delete_item
FUNCTION: Deletes the current SharePoint list item during the Apply_to_each loop.
WHY: Removes outdated alert records one by one.
---------------------------------------------------------------------------
Suodata_AUE_ja_lastsync
FUNCTION: Filters the device list based on specific at-risk criteria.
WHY: Isolates devices where provisionStatus is ACTIVE AND (AUE is within 30 days OR lastPolicySync is older than 30 days).
---------------------------------------------------------------------------
Get_Token
FUNCTION: Performs an HTTP POST to Google OAuth2 services.
WHY: Exchanges a refresh token for a temporary access token to authorize requests to the Google Admin SDK.
---------------------------------------------------------------------------
For_each
FUNCTION: Iterates through each filtered at-risk device.
WHY: Allows the flow to perform individual lookups and logging actions for every device meeting the alert criteria with a concurrency of 50.
---------------------------------------------------------------------------
Connect_Google
FUNCTION: Calls the Google Admin Directory API via HTTP GET for a specific device ID.
WHY: Retrieves the FULL projection of device metadata to identify the most recent user email associated with the hardware.
---------------------------------------------------------------------------
Create_item
FUNCTION: Writes a new record to the SharePoint Alert list.
WHY: Records the Serial Number, Model, AUE date, Last Sync, OS Version, OU, and the retrieved User UPN for administrative follow-up.
---------------------------------------------------------------------------
================================================================================
TECHNICAL SPECIFICATIONS
- Trigger: Request/Manual Button
- Primary Data Source: SharePoint Online (Laiterekisteri site, Master_Chrome.json)
- Target Data Destination: SharePoint Online (List ID: df84e124-5859-4c7a-ae76-099b3d9b4526)
- External API: Google Admin SDK (admin.googleapis.com)
- Authentication: OAuth2 Refresh Token Flow for Google; Connection Reference for SharePoint
- Concurrency: Parallel processing (50) enabled on loops for performance
- Filter Logic: provisionStatus == ACTIVE AND (AUE <= Today + 30 OR LastSync < Today - 30)
================================================================================
CRITICAL NOTES FOR HUMANS:
- Ensure the Google Cloud Project Client Secret and Refresh Token remain valid; if the flow fails at Get_Token, the credentials may have expired.
- The flow expects the Master_Chrome.json to be located in the Shared Documents/Master_Chrome/ folder in SharePoint.
- Date conversion logic relies on the assumption that numeric timestamps from CSV-to-JSON exports use an 1899-12-30 base date.
================================================================================