<#
.SYNOPSIS
    FINAL SAFE WRITER - FINNISH DATE FIX
    - Forces ISO 8601 Date Format (HH:mm:ss) regardless of PC Locale.
    - Writes to 'Uusin käyttäjä' & 'Viimeksikirjauduttu'.
#>

# --- 1. CONFIGURATION ---
$Hostname     = "lappeefi.sharepoint.com"
$SitePath     = "/sites/Laiterekisteri" 
$ListID       = "fe7babf8-2969-4131-af03-2257bc004a9f"

# Serial Column
$Col_Serial   = "field_7"

# Display Names (Script auto-detects the weird internal codes)
$DisplayName_User = "Uusin käyttäjä"
$DisplayName_Date = "Viimeksi kirjauduttu" # Or "Viimeksikirjauduttu"

# --- 2. AUTHENTICATION ---
$ctx = Get-MgContext -ErrorAction SilentlyContinue
if (-not $ctx) {
    Write-Host "Authenticating..." -ForegroundColor Cyan
    Select-MgProfile -Name "beta"
    Connect-MgGraph -Scopes "DeviceManagementManagedDevices.Read.All", "Sites.ReadWrite.All", "User.Read.All"
} else {
    Select-MgProfile -Name "beta"
}

# --- 3. SAFE COLUMN DETECTION ---
Clear-Host
Write-Host "=============================================" -ForegroundColor White
Write-Host " PHASE 0: DETECTING COLUMNS" -ForegroundColor White
Write-Host "============================================="

$SiteLookupId = "$Hostname`:$SitePath"
try {
    $site = Get-MgSite -SiteId $SiteLookupId
    $SiteId = $site.Id
    $allCols = Get-MgSiteListColumn -SiteId $SiteId -ListId $ListID -All
    
    # 1. FIND USER COLUMN
    $UserCols = $allCols | Where-Object { ($_.DisplayName -eq $DisplayName_User) -and ($_.Text -ne $null) }
    if ($UserCols -is [array]) { $UserColObj = $UserCols[0] } else { $UserColObj = $UserCols }

    if ($UserColObj) {
        $TargetUserCol = $UserColObj.Name
        Write-Host " [OK] User Column: '$TargetUserCol'" -ForegroundColor Green
    } else {
        Write-Error "Could not find TEXT column '$DisplayName_User'."
        return
    }
    
    # 2. FIND DATE COLUMN
    $DateCols = $allCols | Where-Object { $_.DisplayName -eq $DisplayName_Date -or $_.Name -eq "Viimeksikirjauduttu" }
    if ($DateCols -is [array]) { $DateColObj = $DateCols[0] } else { $DateColObj = $DateCols }

    if ($DateColObj) {
        $TargetDateCol = $DateColObj.Name
        Write-Host " [OK] Date Column: '$TargetDateCol'" -ForegroundColor Green
    } else {
        Write-Error "Could not find date column '$DisplayName_Date'."
        return
    }
} catch {
    Write-Error "SharePoint Connection Failed: $_"
    return
}

# --- 4. FETCH DATA ---
Write-Host "`n=============================================" -ForegroundColor White
Write-Host " PHASE 1: PREPARING DATA" -ForegroundColor White
Write-Host "============================================="

# SharePoint
Write-Host "Fetching Serial Numbers..." -NoNewline
$listItems = Get-MgSiteListItem -SiteId $SiteId -ListId $ListID -ExpandProperty "fields" -All -PageSize 999
$targetSerials = @()
foreach ($item in $listItems) {
    $sn = $item.Fields.AdditionalProperties[$Col_Serial]
    if (-not $sn) { $sn = $item.Fields[$Col_Serial] }
    if ($sn) { $targetSerials += [PSCustomObject]@{ Serial = $sn; ItemID = $item.Id } }
}
Write-Host " Done ($($targetSerials.Count) items)." -ForegroundColor Green

# Intune
Write-Host "Fetching Intune Data..." -NoNewline
$Uri = "https://graph.microsoft.com/beta/deviceManagement/managedDevices?`$select=serialNumber,deviceName,userPrincipalName,lastSyncDateTime,usersLoggedOn"
$IntuneMap = @{}
while ($Uri) {
    try {
        $response = Invoke-MgGraphRequest -Uri $Uri -Method GET
        foreach ($dev in $response.value) {
            if ($dev.serialNumber) { $IntuneMap[$dev.serialNumber] = $dev }
        }
        $Uri = $response.'@odata.nextLink'
    } catch { $Uri = $null }
}
Write-Host " Done." -ForegroundColor Green

# Resolve Users
Write-Host "Resolving Users..." -NoNewline
$RepoData = @()
$IDsToResolve = @()

foreach ($row in $targetSerials) {
    $rawID = $null; $lastDate = $null; $primary = $null; $found = $false
    if ($IntuneMap.ContainsKey($row.Serial)) {
        $dev = $IntuneMap[$row.Serial]
        $lastSync = $dev.lastSyncDateTime
        $primary = $dev.userPrincipalName
        $recentList = $dev.usersLoggedOn

        if ($recentList) {
            $latest = $recentList | Sort-Object lastLogOnDateTime -Descending | Select-Object -First 1
            if ($latest) {
                $rawID = $latest.userId; $lastDate = $latest.lastLogOnDateTime; $found = $true
                if ($rawID) { $IDsToResolve += $rawID }
            }
        }
        if (-not $found) { $lastDate = $lastSync; $rawID = "PRIMARY:$primary" }
    }
    $RepoData += [PSCustomObject]@{ Serial = $row.Serial; ItemID = $row.ItemID; RawID = $rawID; LastDate = $lastDate }
}

$uniqueIDs = $IDsToResolve | Select-Object -Unique
$UserMap = @{}
foreach ($id in $uniqueIDs) {
    if ($id -match "PRIMARY:(.*)") { $UserMap[$id] = $matches[1] }
    elseif ($id -match "^S-1-") { $UserMap[$id] = "Local Account" }
    else {
        try { $u = Get-MgUser -UserId $id -Property DisplayName -ErrorAction Stop; $UserMap[$id] = $u.DisplayName } 
        catch { $UserMap[$id] = "Unknown" }
    }
}
Write-Host " Done." -ForegroundColor Green

# --- 5. WRITE BACK (FIXED DATE FORMAT) ---
Write-Host "`n=============================================" -ForegroundColor White
Write-Host " PHASE 2: UPDATING SHAREPOINT" -ForegroundColor White
Write-Host "============================================="

$counter = 0
$total = $RepoData.Count

foreach ($row in $RepoData) {
    $counter++
    
    $finalUser = ""
    if ($row.RawID) {
        if ($UserMap.ContainsKey($row.RawID)) { $finalUser = $UserMap[$row.RawID] }
        else { $finalUser = $row.RawID }
    }

    $finalDateStr = $null
    if ($row.LastDate) {
        $finalDate = [DateTime]$row.LastDate
        
        # --- THE FIX IS HERE ---
        # We use 'InvariantCulture' to force colons (:) instead of dots (.)
        $finalDateStr = $finalDate.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ", [System.Globalization.CultureInfo]::InvariantCulture)
    }

    if ($finalUser -or $finalDateStr) {
        Write-Host "[$counter/$total] Updating $($row.Serial)..." -NoNewline
        
        $body = @{}
        if (-not [string]::IsNullOrWhiteSpace($finalUser)) { $body[$TargetUserCol] = $finalUser }
        if ($finalDateStr) { $body[$TargetDateCol] = $finalDateStr }

        $jsonBody = $body | ConvertTo-Json -Compress
        $updateUrl = "https://graph.microsoft.com/v1.0/sites/$SiteId/lists/$ListID/items/$($row.ItemID)/fields"

        try {
            Invoke-MgGraphRequest -Uri $updateUrl -Method PATCH -Body $jsonBody -ContentType "application/json"
            Write-Host " Success" -ForegroundColor Green
        } catch {
            $err = $_.Exception.Message
            if ($_.ErrorDetails.Message) { $err = $_.ErrorDetails.Message }
            Write-Host " Failed: $err" -ForegroundColor Red
            Write-Host " Payload: $jsonBody" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "[$counter/$total] $($row.Serial) - No data." -ForegroundColor Gray
    }
}

Write-Host "`nAll Done!" -ForegroundColor Cyan