# Keeps Windows from idle-sleeping for as long as this window stays open (no settings are changed; closing it or Ctrl-C releases it).
Add-Type -Namespace Win -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
$ES_CONTINUOUS = 2147483648; $ES_SYSTEM_REQUIRED = 1
Write-Host "Awake mode on. Close this window or press Ctrl-C to let the PC sleep again."
while ($true) {
  [void][Win.Power]::SetThreadExecutionState($ES_CONTINUOUS -bor $ES_SYSTEM_REQUIRED)
  Start-Sleep -Seconds 30
}
