Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$proc = Get-Process -Name "qemu-system-x86_64","emulator" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($proc -ne $null) {
    [Win32]::ShowWindow($proc.MainWindowHandle, 9)
    [Win32]::SetForegroundWindow($proc.MainWindowHandle)
    Write-Host "Emulator brought to front!"
} else {
    Write-Host "Emulator not found - starting it now..."
    Start-Process "C:\Users\msi\AppData\Local\Android\Sdk\emulator\emulator.exe" -ArgumentList "-avd Pixel_4"
}
