Add-Type -AssemblyName System.Drawing

function New-VanIcon {
    param(
        [int]$Size,
        [string]$OutPath,
        [bool]$Maskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    $bg = [System.Drawing.Color]::FromArgb(255, 27, 58, 47)   # #1b3a2f
    $white = [System.Drawing.Color]::FromArgb(255, 247, 245, 240) # #f7f5f0
    $accent = [System.Drawing.Color]::FromArgb(255, 201, 118, 44) # #c9762c

    $bgBrush = New-Object System.Drawing.SolidBrush($bg)

    if ($Maskable) {
        $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
        $scale = $Size * 0.62
        $offsetX = ($Size - $scale) / 2
        $offsetY = ($Size - $scale) / 2 + ($Size * 0.03)
    } else {
        $radius = $Size * 0.22
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $radius * 2
        $path.AddArc(0, 0, $d, $d, 180, 90)
        $path.AddArc($Size - $d, 0, $d, $d, 270, 90)
        $path.AddArc($Size - $d, $Size - $d, $d, $d, 0, 90)
        $path.AddArc(0, $Size - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        $g.FillPath($bgBrush, $path)
        $scale = $Size * 0.72
        $offsetX = ($Size - $scale) / 2
        $offsetY = ($Size - $scale) / 2 + ($Size * 0.02)
    }

    # Van body (relative to scale box)
    $whiteBrush = New-Object System.Drawing.SolidBrush($white)
    $accentBrush = New-Object System.Drawing.SolidBrush($accent)
    $bgBrush2 = New-Object System.Drawing.SolidBrush($bg)

    function P($fx, $fy) {
        return New-Object System.Drawing.PointF(($offsetX + $fx * $scale), ($offsetY + $fy * $scale))
    }

    # Main body: rounded rectangle silhouette using a path
    $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bx = $offsetX + 0.04 * $scale
    $by = $offsetY + 0.30 * $scale
    $bw = 0.92 * $scale
    $bh = 0.36 * $scale
    $br = 0.08 * $scale
    $bd = $br * 2
    $bodyPath.AddArc($bx, $by, $bd, $bd, 180, 90)
    $bodyPath.AddArc($bx + $bw - $bd, $by, $bd, $bd, 270, 90)
    $bodyPath.AddArc($bx + $bw - $bd, $by + $bh - $bd, $bd, $bd, 0, 90)
    $bodyPath.AddArc($bx, $by + $bh - $bd, $bd, $bd, 90, 90)
    $bodyPath.CloseFigure()
    $g.FillPath($whiteBrush, $bodyPath)

    # Cabin roof bump (front-right)
    $roofPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rx = $offsetX + 0.50 * $scale
    $ry = $offsetY + 0.14 * $scale
    $rw = 0.46 * $scale
    $rh = 0.20 * $scale
    $rr = 0.07 * $scale
    $rd = $rr * 2
    $roofPath.AddArc($rx, $ry, $rd, $rd, 180, 90)
    $roofPath.AddArc($rx + $rw - $rd, $ry, $rd, $rd, 270, 90)
    $roofPath.AddLine(($rx + $rw), ($ry + $rh), $rx, ($ry + $rh))
    $roofPath.AddArc($rx, $ry + $rh - $rd, $rd, $rd, 90, 90)
    $roofPath.CloseFigure()
    $g.FillPath($whiteBrush, $roofPath)

    # Window on cabin
    $winX = $offsetX + 0.58 * $scale
    $winY = $offsetY + 0.19 * $scale
    $winW = 0.30 * $scale
    $winH = 0.13 * $scale
    $g.FillRectangle($accentBrush, $winX, $winY, $winW, $winH)

    # Side stripe (accent) across body
    $stripeY = $offsetY + 0.42 * $scale
    $stripeH = 0.06 * $scale
    $g.FillRectangle($accentBrush, $bx, $stripeY, $bw, $stripeH)

    # Wheels
    $wheelR = 0.11 * $scale
    $wheel1X = $offsetX + 0.20 * $scale
    $wheel2X = $offsetX + 0.72 * $scale
    $wheelY = $offsetY + 0.60 * $scale
    $g.FillEllipse($bgBrush2, ($wheel1X - $wheelR), ($wheelY - $wheelR), ($wheelR * 2), ($wheelR * 2))
    $g.FillEllipse($bgBrush2, ($wheel2X - $wheelR), ($wheelY - $wheelR), ($wheelR * 2), ($wheelR * 2))
    $hubR = 0.045 * $scale
    $g.FillEllipse($whiteBrush, ($wheel1X - $hubR), ($wheelY - $hubR), ($hubR * 2), ($hubR * 2))
    $g.FillEllipse($whiteBrush, ($wheel2X - $hubR), ($wheelY - $hubR), ($hubR * 2), ($hubR * 2))

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Path $iconsDir | Out-Null }

New-VanIcon -Size 192 -OutPath (Join-Path $iconsDir "icon-192.png") -Maskable $false
New-VanIcon -Size 512 -OutPath (Join-Path $iconsDir "icon-512.png") -Maskable $false
New-VanIcon -Size 180 -OutPath (Join-Path $iconsDir "icon-180.png") -Maskable $false
New-VanIcon -Size 192 -OutPath (Join-Path $iconsDir "icon-192-maskable.png") -Maskable $true
New-VanIcon -Size 512 -OutPath (Join-Path $iconsDir "icon-512-maskable.png") -Maskable $true

Write-Host "Icons generated in $iconsDir"
