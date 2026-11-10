param(
    [string]$Source
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not $Source) {
    $logoName = 'Logo_Pok' + [char]0x00E9 + 'ballZBattle.png'
    $Source = Join-Path (Join-Path $PSScriptRoot '../../../Graphics') $logoName
}
$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$resourcePath = Join-Path $PSScriptRoot '../android/app/src/main/res'
$sizes = [ordered]@{
    mdpi = 48
    hdpi = 72
    xhdpi = 96
    xxhdpi = 144
    xxxhdpi = 192
}

function Write-Icon([System.Drawing.Image]$image, [int]$size, [string]$path) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage($image, 0, 0, $size, $size)
        } finally {
            $graphics.Dispose()
        }
        $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $bitmap.Dispose()
    }
}

$image = [System.Drawing.Image]::FromFile($sourcePath)
try {
    if ($image.Width -ne $image.Height) {
        throw "The launcher logo must be square: $sourcePath"
    }
    foreach ($density in $sizes.Keys) {
        $size = $sizes[$density]
        $directory = Join-Path $resourcePath "mipmap-$density"
        Write-Icon $image $size (Join-Path $directory 'ic_launcher.png')
        Write-Icon $image $size (Join-Path $directory 'ic_launcher_round.png')
    }
} finally {
    $image.Dispose()
}
