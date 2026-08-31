========================================================================
POWER AUTOMATE FLOW DOCUMENTATION: Today_Win
========================================================================
Purpose: 
This flow updates a Master JSON file of device records with new info 
provided by support techs via Power Apps. It runs daily, ensuring 
no existing data is wiped out if a field is left blank.

========================================================================
STEP-BY-STEP BREAKDOWN
========================================================================

1. TRIGGER: Recurrence
WHAT IT DOES: Runs the flow automatically once a day at a scheduled time.
WHY IT IS THERE: To batch process all of the day's updates at once rather 
than running constantly, which saves API calls and prevents file lock 
issues on the Master JSON.

2. INITIALIZE VARIABLE: MasterDeviceList
WHAT IT DOES: Creates an empty "bucket" (Array) in the flow's memory.
WHY IT IS THERE: We cannot directly edit the Master JSON file. We have to 
build a brand-new list of devices in this bucket, and then replace the 
old file with this newly built list at the very end.

3. GET NEW DATA (SharePoint)
WHAT IT DOES: Pulls all the recent device updates from the "Today_Win" 
SharePoint list that the support team uses in Power Apps.
WHY IT IS THERE: This provides the new data (new names, cost centers) 
that needs to be merged into the Master list.

4. GET MASTER DATA (SharePoint)
WHAT IT DOES: Downloads the current Master_WIN.json file.
WHY IT IS THERE: We need the existing database so we know what data to 
keep (like Models and Lease dates) for the devices being updated.

5. PARSE JSON
WHAT IT DOES: Converts the raw text of the Master_WIN.json file into a 
readable list of individual device objects.
WHY IT IS THERE: Power Automate cannot read text files directly. This 
turns the file into Dynamic Content tags so we can use them later.

6. SELECT
WHAT IT DOES: Takes the New Data from step 3 and renames the columns 
(e.g., changes 'Title' to 'Laitteen sarjanumero').
WHY IT IS THERE: To ensure the new data fields have clean, standardized 
names before we try to match them with the Master data.

7. FILTER ARRAY
WHAT IT DOES: Scans the Master Data and REMOVES any devices that have 
the same Serial Number as the ones in the New Data list.
WHY IT IS THERE: This separates the devices that are NOT being updated 
today. We set these aside so we can safely add the updated ones later 
without creating duplicates.

8. SET VARIABLE
WHAT IT DOES: Takes the output of the Filter Array and dumps it into the 
MasterDeviceList bucket we made in Step 1.
WHY IT IS THERE: Now our bucket contains all the old, un-updated devices. 
It is ready for us to append the freshly updated devices to it.

9. APPLY TO EACH (Loop)
WHAT IT DOES: Loops through the list of New Updates one by one.
WHY IT IS THERE: We have to process each update individually to ensure 
we mix the correct old data with the correct new data.

   9a. GET ORIGINAL ITEM (Inside the loop)
   WHAT IT DOES: Searches the original Master Data for the specific 
   device we are currently looking at in the loop.
   WHY IT IS THERE: We need the original device's untouched data (like 
   its Model or Device ID) so we don't lose it during the update.

   9b. APPEND TO ARRAY VARIABLE (Inside the loop)
   WHAT IT DOES: Merges the New Data and the Original Item data together 
   into a single complete device record, then drops it into the 
   MasterDeviceList bucket.
   WHY IT IS THERE: It uses an 'if empty' rule. If the tech typed a new 
   name, it uses the new name. If they left it blank, it keeps the old 
   name. It ensures the Master bucket has a perfect, fully updated list.

10. UPDATE FILE (SharePoint)
WHAT IT DOES: Takes everything inside the MasterDeviceList bucket and 
overwrites the Master_WIN.json file in SharePoint.
WHY IT IS THERE: This is the final save. The old file is replaced with 
the newly rebuilt, perfectly updated array.

========================================================================
END OF DOCUMENTATION
========================================================================