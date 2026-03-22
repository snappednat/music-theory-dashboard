$ErrorActionPreference = 'Stop'
try {
    $port = 7777
    $listener = [System.Net.HttpListener]::new()
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
    Write-Host "SUCCESS: Listening on port $port"
    Start-Sleep 2
    $listener.Stop()
    Write-Host "Stopped cleanly"
} catch {
    Write-Host "FAILED: $($_.Exception.Message)"
    Write-Host "Type: $($_.Exception.GetType().FullName)"
    exit 1
}
