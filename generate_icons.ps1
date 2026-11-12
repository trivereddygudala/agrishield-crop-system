Add-Type -AssemblyName System.Drawing

$srcPath = "C:\AI Crop Disease Detection System\frontend\public\icon-512.png"
$srcBytes = [System.IO.File]::ReadAllBytes($srcPath)
$ms = New-Object System.IO.MemoryStream($srcBytes, 0, $srcBytes.Length)
$srcImage = [System.Drawing.Image]::FromStream($ms)

Write-Host "Source image dimensions: $($srcImage.Width) x $($srcImage.Height)"

function ConvertTo-Png($src, [int]$w, [int]$h, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved true PNG ($w x $h) to $outPath"
}

ConvertTo-Png $srcImage 192 192 "C:\AI Crop Disease Detection System\frontend\public\icon-192.png"
ConvertTo-Png $srcImage 512 512 "C:\AI Crop Disease Detection System\frontend\public\icon-512.png"
ConvertTo-Png $srcImage 96 96 "C:\AI Crop Disease Detection System\frontend\public\icon-96.png"

$srcImage.Dispose()
$ms.Dispose()
Write-Host "All icons generated successfully!"
