const { io } = require("socket.io-client");
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const path = require('path');

const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
const configPath = path.join(baseDir, 'config.json');

console.log("==========================================");
console.log("   HIRUSTAR SCOREBOARD REMOTE AGENT       ");
console.log("==========================================\n");

let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error("[ERROR] Failed to load config.json:");
  console.error(`Please ensure a config.json file exists at: ${configPath}`);
  console.error("Error details:", err.message);
  process.exit(1);
}

// Find local IP
let localIp = null;
const interfaces = os.networkInterfaces();
for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      if (config.ipsToJudges && config.ipsToJudges[iface.address]) {
        localIp = iface.address;
        break;
      }
    }
  }
  if (localIp) break;
}

const judgeId = localIp ? config.ipsToJudges[localIp] : null;

if (judgeId) {
  console.log(`[INFO] Detected Local IP: ${localIp} -> Matched Judge ${judgeId}`);
  // Launch Chrome
  const targetUrl = `${config.serverUrl}/judge/${judgeId}`;
  console.log(`[INFO] Launching browser to: ${targetUrl}`);
  // Start chrome fullscreen
  exec(`start chrome --start-fullscreen "${targetUrl}"`, (err) => {
    if (err) console.error("[ERROR] Failed to launch Chrome:", err.message);
  });
} else {
  console.log(`[WARNING] This IP is not in config.json. Running as generic agent without auto-launching Chrome.`);
}

console.log(`\n[INFO] Connecting to ${config.serverUrl}...`);
const socket = io(config.serverUrl);

socket.on('connect', () => {
  console.log('[SUCCESS] Connected to server.');
  // Identify as a generic agent type so it doesn't duplicate the actual judge socket connection visually
  socket.emit('identify', { type: 'agent', id: judgeId });
});

socket.on('disconnect', () => {
  console.log('[INFO] Disconnected from server. Trying to reconnect...');
});

socket.on('focus_window', ({ target }) => {
  console.log(`\n[REMOTE] Received switch command -> Target: ${target}`);
  
  let targetProcess = '';
  if (target === 'browser') {
    targetProcess = config.browserProcessName || 'chrome';
  } else if (target === 'exe') {
    targetProcess = config.exeProcessName || 'YourExeName';
  }

  if (!targetProcess) {
    console.log("[WARNING] Unknown target or missing process name in config.");
    return;
  }

  console.log(`[INFO] Attempting to bring '${targetProcess}' to the foreground...`);

  const tempPath = path.join(os.tmpdir(), 'focus_window.ps1');
  const psScript = `
$proc = Get-Process -Name "${targetProcess}" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($proc) {
    # Method 1: WScript.Shell AppActivate
    $wshell = New-Object -ComObject wscript.shell
    $wshell.SendKeys('%')  # Send ALT key to bypass foreground lock timeout
    Start-Sleep -Milliseconds 50
    $wshell.AppActivate($proc.Id)
    
    # Method 2: C# Win32 API Fallback (Restore and Force Foreground)
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Win32 {
        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      }
"@
    [Win32]::ShowWindow($proc.MainWindowHandle, 9) # SW_RESTORE
    [Win32]::SetForegroundWindow($proc.MainWindowHandle)
} else {
  Write-Host "Process Not Found"
}
`;

  try {
    fs.writeFileSync(tempPath, psScript);
    exec(`powershell -ExecutionPolicy Bypass -File "${tempPath}"`, (err, stdout) => {
      if (err) {
        console.error("[ERROR] Failed to focus window:", err.message);
      } else {
        const out = stdout.trim();
        if (out === "Process Not Found") {
          console.log(`[WARNING] Could not find a running window for process '${targetProcess}'.`);
        } else {
          console.log(`[SUCCESS] Focused '${targetProcess}'.`);
        }
      }
    });
  } catch (writeErr) {
    console.error("[ERROR] Failed to write PowerShell script:", writeErr.message);
  }
});
