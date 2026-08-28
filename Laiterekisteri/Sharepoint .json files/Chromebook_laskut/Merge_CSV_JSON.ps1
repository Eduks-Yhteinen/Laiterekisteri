# 1. Load the JSON data
$jsonFilePath = "C:\Users\hulkkopp\Lappeenranta sivistys\Laiterekisteri - Documents\Master_Chrome\Master_Chrome.json"
$jsonData = Get-Content -Path $jsonFilePath -Raw | ConvertFrom-Json

# 2. Load the Excel data (Saved as CSV)
$csvFilePath = "C:\Users\hulkkopp\Lappeenranta sivistys\Laiterekisteri - Documents\Master_Chrome\Chromebook_laskut\chrome_laskut.csv"
$excelData = Import-Csv -Path $csvFilePath -Delimiter ';'

# 3. Create a lightning-fast Lookup Table from the CSV
$excelLookup = @{}
foreach ($row in $excelData) {
    # Safely grab the serial column and convert it to a string
    $rawSerial = [string]$row.serial
    
    # Only process it if the serial isn't empty
    if ($rawSerial.Trim() -ne "") {
        $cleanSerial = $rawSerial.Trim().ToUpper()
        $excelLookup[$cleanSerial] = $row
    }
}

# 4. Loop through JSON and update it directly
$matchCount = 0

foreach ($device in $jsonData) {
    # Clean the JSON serial safely
    $rawDeviceSerial = [string]$device.serialNumber
    $deviceSerial = $rawDeviceSerial.Trim().ToUpper()

    # Check if the serial exists in our CSV lookup table
    if ($excelLookup.ContainsKey($deviceSerial)) {
        
        # Grab the matching row from the CSV
        $matchedExcelRow = $excelLookup[$deviceSerial]
        
       # Grab the matching row from the CSV
        $matchedExcelRow = $excelLookup[$deviceSerial]
        
        # Inject the Excel data directly into the current JSON item!
        $device | Add-Member -MemberType NoteProperty -Name "kuitin_nimi" -Value $matchedExcelRow.kuitin_nimi -Force
        $device | Add-Member -MemberType NoteProperty -Name "laskuID" -Value $matchedExcelRow.laskuID -Force
        $device | Add-Member -MemberType NoteProperty -Name "toimituspvm" -Value $matchedExcelRow.toimituspvm -Force
        
        $matchCount++
    }
}

# 5. Overwrite the original JSON file directly WITHOUT the invisible BOM character
$jsonOutput = $jsonData | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($jsonFilePath, $jsonOutput, $utf8NoBom)

Write-Host "Data merged successfully! Overwrote the original file with $matchCount updated records." -ForegroundColor Green