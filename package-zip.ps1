# Create zip distribution for Windows
param([string]$OutPath = "VoxelAI-Studio-Windows-x64.zip")

$distDir = "dist\win-unpacked"
if (Test-Path $distDir) {
    if (Test-Path $OutPath) { Remove-Item $OutPath -Force }
    Compress-Archive -Path "$distDir\*" -DestinationPath $OutPath -CompressionLevel Optimal
    Write-Host "✅ Created standalone zip package at $OutPath"
} else {
    Write-Host "❌ Directory $distDir not found!"
}
