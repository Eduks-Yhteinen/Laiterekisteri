================================================================================
DOCUMENTATION: END OF LIFE CYCLE DEVICES POWER AUTOMATE FLOW
OVERALL LOGIC "THE BIG IDEA":
The flow is a Data Enrichment Pipeline. It takes a static list of all company
devices, filters for those expiring in the next 185 days (approx. 6 months) OR
devices inactive for over 30 days, and cross-checks live Microsoft Intune data
to find the real-world user. The final result is a high-accuracy Replacement
Dashboard in SharePoint.
================================================================================
COMPONENT BREAKDOWN & PURPOSE:
TRIGGER: RECURRENCE
FUNCTION: Runs every Sunday at 08:00 AM (FLE Standard Time).
WHY: Automatically refreshes the device registry once a week so IT admins always
have a current view without manual work.
---------------------------------------------------------------------------
INITIALIZATION: DATE CALCULATIONS
FUNCTION: Sets var_FutureDate (Today + 185 days), var_Today, and var_30DaysAgo.
WHY: Defines the 185-day window for expiring devices and the 30-day window to
flag inactive devices.
---------------------------------------------------------------------------
HOUSEKEEPING: REFRESH SHAREPOINT LIST
FUNCTION: Retrieves items from Laiterekisteri list and deletes them.
WHY: It is cleaner to wipe the dashboard and rebuild it fresh than to manage
complex updates, which prevents duplicate entries.
---------------------------------------------------------------------------
DATA RETRIEVAL: LOAD MASTER FILE
FUNCTION: Pulls Master_WIN.json from SharePoint and parses its content.
WHY: Power Automate needs to parse the text file to understand individual data
fields like Serial Number, Lease End date, and Last Check-In.
---------------------------------------------------------------------------
INTELLIGENCE: DATA FILTERING
FUNCTION: Filter_Sanitize validates lease date and Last Check-In formatting.
Filter_Date_Logic discards devices outside the 185-day expiration window UNLESS
their Last Check-In is older than 30 days.
WHY: Removes noise from the data and ensures the flow only processes devices
that need upcoming attention or are suspiciously inactive.
---------------------------------------------------------------------------
ENRICHMENT: THE INTUNE LOOP
FUNCTION: Queries Microsoft Intune Graph API for every filtered device by Serial.
WHY: The static master file might have old owner info. Intune has live data of
who is actually logging into that laptop today.
---------------------------------------------------------------------------
LOGIC: THE USER VERIFICATION BRANCH
FUNCTION: Evaluates the Intune response. If users are found, converts Intune
User ID (GUID) to email. If GUID lookup fails, outputs DeletedUser. If no user
is logged in or device is missing from Intune, outputs No user.
WHY: Provides Data Confidence by explicitly warning IT staff when a machine is
orphaned, unmanaged in Endpoint, or assigned to a deleted account.
---------------------------------------------------------------------------
OUTPUT: CREATE SHAREPOINT ITEM
FUNCTION: Writes the final, enriched record to the SharePoint list.
WHY: Creates a centralized, readable dashboard of all hardware replacements and
inactive devices needed in the coming months.
---------------------------------------------------------------------------
================================================================================
TECHNICAL SPECIFICATIONS
SHAREPOINT SITE: https://lappeefi.sharepoint.com/sites/Laiterekisteri
GRAPH ENDPOINT: https://graph.microsoft.com/beta/deviceManagement/managedDevices
AUTH METHOD: Active Directory OAuth (Client ID: 9ecf38ba-133c-4334-9943-2386f58a3043)
VERSION HISTORY: Updated to include 30-day inactivity filter, var_30DaysAgo
logic, and DeletedUser handling for failed GUID lookups.
================================================================================
CRITICAL NOTES FOR HUMANS:
- GHOST CHARACTERS: The Intune Graph API step includes a replace function
looking for decodeUriComponent('%C2%A0'). This strips invisible non-breaking
spaces from serial numbers so the API search does not fail.
- MISSING DEVICES & MASTER JSON INTEGRITY: If computers stop appearing, check
the flow that generates Master_WIN.json. If it uses string concat instead of
array union, it will create a broken JSON file with "][". Power Automate will
only read the first half. Always ensure the Master file is fused correctly.
================================================================================