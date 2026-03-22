# Simple HTTP server for the Guitar Music Theory Dashboard
# Serves files from the current directory on port 8080

$port = if ($env:PORT) { [int]$env:PORT } else { 3000 }
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css'
  '.js'   = 'application/javascript'
  '.json' = 'application/json'
  '.png'  = 'image/png'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.woff2'= 'font/woff2'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Guitar Theory Dashboard running at http://localhost:$port"
Write-Host "Press Ctrl+C to stop."

try {
  while ($listener.IsListening) {
    $ctx  = $listener.GetContext()
    $req  = $ctx.Request
    $resp = $ctx.Response

    $localPath = $req.Url.LocalPath.TrimStart('/')
    if ($localPath -eq '' -or $localPath -eq '/') { $localPath = 'index.html' }
    $filePath = Join-Path $root $localPath

    if (Test-Path $filePath -PathType Leaf) {
      $ext  = [System.IO.Path]::GetExtension($filePath)
      $mime = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $resp.ContentType     = $mime
      $resp.ContentLength64 = $bytes.Length
      $resp.AddHeader('Access-Control-Allow-Origin', '*')
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes('Not found')
      $resp.ContentLength64 = $msg.Length
      $resp.OutputStream.Write($msg, 0, $msg.Length)
    }

    $resp.Close()
  }
} finally {
  $listener.Stop()
}
