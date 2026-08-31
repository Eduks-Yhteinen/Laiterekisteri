================================================================================
PROJECT: Laiterekisteri Automation (Chromebook Master Update)
DATE:    March 20, 2026
STATUS:  BACKEND COMPLETE / READY FOR DATABASE MAPPING
OVERVIEW

The goal is to automate the tracking and updating of Chromebook devices into the
Laiterekisteri database. The system reads a converted JSON file (originating from
an Excel export), safely parses the data using a flexible schema, converts raw
Excel date serial numbers into readable text, and prepares a clean payload for
the SharePoint List.

ARCHITECTURE & DATA FLOW

[Chromebook .xlsx] -> [Converted to .json] -> [Power Automate] -> [Apply to Each Mapping] -> [SharePoint List]

A. SOURCE DATA

File: "Chromebook_Master.json" (Converted from Excel Export)

Action: "Get_Master_Data" (Get file content)

B. DATA TRANSFORMATION (The Base64 & Schema Fix)

Tool: Power Automate (Data Operations)

Output: Parsed JSON Array

Logic:

Get file content.

Decode the hidden Base64 file envelope using:
base64ToString(body('Get_Master_Data')?['$content'])

Parse JSON using a relaxed "Any-Type" {} schema.

Map fields in an "Apply to each" loop.

C. THE PAYLOAD (Data Mapping)

Captures: ItemInternalId, Internal_ID (deviceId), Serial, Model, OS,
Last Checkin, OrgUnitPath, Provision_Status, AutoUpdateExpiration,
and MostRecentActivity.

KEY ISSUES RESOLVED (TROUBLESHOOTING LOG)

[FIXED] API Error 429 "TooManyConsecutiveFailures"

Issue: The "Excel Online (Business)" connector locked the account in a
timeout because it could not find a formalized Table (e.g., Table1), or
the file size/request limits were exceeded during testing.

Fix: Switched from direct Excel querying to utilizing a pre-converted
.json file, bypassing Graph API limits entirely.

[FIXED] "Invalid Expression" - The File Envelope Trap

Issue: Using string(body('Get_Master_Data')) failed because Power Automate
pulls files as secure Base64 JSON objects, not raw text.

Fix: Applied the base64ToString(...) formula to crack open the file
envelope and extract the raw text.

[FIXED] "Invalid Expression" - Case Sensitivity

Issue: The expression was written as @String(...) with a capital 'S'.

Fix: Corrected to lowercase @string(...) in the Flow's backend code.

[FIXED] Schema Crash - The @odata.etag Trap

Issue: The JSON schema contained "@odata.etag": {}. The flow checker
saw the @ symbol, assumed it was the start of a broken mathematical
formula, and completely crashed the Parse JSON step.

Fix: Deleted the @odata.etag line from the schema entirely.

[FIXED] The Excel Date Curse (Raw Serial Numbers)

Issue: Excel exported dates as raw numerical serials (e.g., "46098.35").
Pushing this directly into a SharePoint Date column causes a failure.

Fix: Wrapped the variables in a mathematical conversion formula:
addDays('1899-12-30', int(split(string(items('Apply_to_each')?['lastPolicySync']), '.')[0]), 'yyyy-MM-dd')

CURRENT STATE

The Chromebook JSON file is successfully read and Base64-decoded.

The Parse JSON action successfully validates the data using the clean schema.

The mapping payload is configured to handle missing data (like IMEI) and
correctly converts Excel dates.

NEXT STEPS

OBJECTIVE: Write data to Laiterekisteri SharePoint List.

Create/Update SharePoint Item:

Add the "Create item" or "Update item" action inside the Apply to Each loop.

Map the clean Chromebook Payload directly to the SharePoint columns.

Automate "Kustannuspaikka" (Cost Center) Tagging:

Use the OrgUnitPath field (e.g., "/perusopetus/oppilaat/kesamaen_koulu")
to build a Switch or If/Then condition.

Automatically assign the correct Cost Center based on the school name in
the path before saving to SharePoint.

================================================================================