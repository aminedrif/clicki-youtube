Add-Type -AssemblyName System.Drawing

$assetsDir = "play_store_assets"
if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
}

$srcPath = Resolve-Path "assets\icon.png"
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

# 1. Google Play Store Required App Icon (512x512 PNG)
$icon512 = New-Object System.Drawing.Bitmap 512, 512
$g1 = [System.Drawing.Graphics]::FromImage($icon512)
$g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g1.DrawImage($srcImg, 0, 0, 512, 512)
$g1.Dispose()
$icon512.Save("$assetsDir\icon_512x512.png", [System.Drawing.Imaging.ImageFormat]::Png)
$icon512.Dispose()

# 2. Google Play Store Required Feature Graphic (1024x500 PNG)
$feature = New-Object System.Drawing.Bitmap 1024, 500
$g2 = [System.Drawing.Graphics]::FromImage($feature)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.Clear([System.Drawing.Color]::FromArgb(255, 0, 0, 0))

# Center the 500x500 black hole disk on pure black 1024x500 banner
$offsetX = [int]((1024 - 500) / 2)
$g2.DrawImage($srcImg, $offsetX, 0, 500, 500)
$g2.Dispose()
$feature.Save("$assetsDir\feature_graphic_1024x500.png", [System.Drawing.Imaging.ImageFormat]::Png)
$feature.Dispose()

$srcImg.Dispose()
Write-Host "PLAY STORE GRAPHICS SUCCESSFULLY CREATED!"
