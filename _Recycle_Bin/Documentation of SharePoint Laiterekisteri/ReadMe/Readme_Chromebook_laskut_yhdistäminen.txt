================================================================================
README: CSV to JSON Serial Number Merger Script
================================================================================

DESCRIPTION:
This PowerShell script is designed to rapidly merge billing and hardware 
information from an Excel/CSV file directly into a master JSON dataset. 

Instead of relying on slow cloud flows (like Power Automate) which can time out 
with thousands of records, this script uses a memory-based Hash Table to match 
and inject data in a matter of seconds. 

It matches devices based on their Serial Number and injects the following 
fields into the JSON file:
- kuitin_nimi
- laskuID
- toimituspvm

================================================================================
PREREQUISITES & FILE LOCATIONS:
================================================================================

1. MASTER JSON FILE:
   Path: C:\Users\hulkkopp\Downloads\Master_Chrome.json
   Requirement: Must contain JSON objects with a "serialNumber" property.

2. EXCEL/CSV DATA FILE:
   Path: C:\Users\hulkkopp\Downloads\chrome_laskut.csv
   Requirement: You must "Save As" your Excel file to a CSV format. Because of 
   the European/Finnish locale, the script expects Semicolons (;) as the 
   separator, which Excel will do automatically.
   
   CRITICAL: The CSV MUST have these exact column headers (case-insensitive):
   - serial
   - kuitin_nimi
   - laskuID
   - toimituspvm