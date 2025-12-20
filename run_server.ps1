$port = 8080
$url = "http://localhost:$port"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("$url/")
$listener.Start()

Write-Host "--- Servidor SynoStream Iniciado ---" -ForegroundColor Green
Write-Host "Abre tu navegador en: $url" -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener el servidor"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
        $localPath = Join-Path (Get-Location) $path

        if (Test-Path $localPath -PathType Leaf) {
            $content = [System.IO.File]::ReadAllBytes($localPath)
            
            # Content types
            if ($path.EndsWith(".html")) { $response.ContentType = "text/html" }
            elseif ($path.EndsWith(".css")) { $response.ContentType = "text/css" }
            elseif ($path.EndsWith(".js")) { $response.ContentType = "application/javascript" }
            elseif ($path.EndsWith(".json")) { $response.ContentType = "application/json" }
            elseif ($path.EndsWith(".png")) { $response.ContentType = "image/png" }

            $response.ContentLength64 = $content.Length
            $response.OutputStream.Write($content, 0, $content.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
