Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WindowHelper {
    [DllImport("user32.dll")]
    public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@

# Start emulator fresh
$emulatorPath = "C:\Users\msi\AppData\Local\Android\Sdk\emulator\emulator.exe"
Start-Process $emulatorPath -ArgumentList "-avd Pixel_4 -no-snapshot-load"

Write-Host "Waiting for emulator window to appear..."
$hwnd = [IntPtr]::Zero
$tries = 0
while ($hwnd -eq [IntPtr]::Zero -and $tries -lt 30) {
    Start-Sleep -Seconds 2
    $proc = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($proc) {
        $hwnd = $proc.MainWindowHandle
    }
    $tries++
}

if ($hwnd -ne [IntPtr]::Zero) {
    # Move window to visible position: top-left of primary monitor
    [WindowHelper]::ShowWindow($hwnd, 9)   # SW_RESTORE
    [WindowHelper]::MoveWindow($hwnd, 100, 50, 420, 820, $true)
    [WindowHelper]::SetForegroundWindow($hwnd)
    Write-Host "Emulator repositioned and brought to front!"
} else {
    Write-Host "Could not find emulator window handle - please check taskbar"
}
