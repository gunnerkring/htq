const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const electronBinaryPath = require("electron");

const rootDir = path.resolve(__dirname, "..");
const viteCliPath = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const tscCliPath = path.join(rootDir, "node_modules", "typescript", "lib", "tsc.js");
const electronMainPath = path.join(rootDir, "dist-electron", "electron", "main.js");
const electronPreloadPath = path.join(rootDir, "dist-electron", "electron", "preload.js");
const electronOutputDir = path.dirname(electronMainPath);

let shuttingDown = false;
let electronProcess = null;
let electronBuildReady = false;
let electronHasStarted = false;
let restartTimer = null;
let electronWatcher = null;
const managedChildren = [];
let viteServerUrl = null;

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

function wireOutput(child, label, onChunk) {
  const handle = (stream, writer) => {
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      writer(text);
      onChunk?.(text);
    });
  };

  handle(child.stdout, (text) => process.stdout.write(text));
  handle(child.stderr, (text) => process.stderr.write(text));

  child.on("exit", (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`${label} exited with code ${code}.`);
      shutdown(code ?? 1);
    }
  });
}

function spawnManaged(command, args, label, onChunk) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  managedChildren.push(child);
  wireOutput(child, label, onChunk);
  return child;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFile(filePath, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      return;
    }

    await sleep(200);
  }

  throw new Error(`Timed out waiting for ${filePath}`);
}

async function waitForDevServer(url, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const isReady = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode !== undefined);
      });

      request.on("error", () => resolve(false));
      request.setTimeout(2000, () => {
        request.destroy();
        resolve(false);
      });
    });

    if (isReady) {
      return;
    }

    await sleep(300);
  }

  throw new Error(`Timed out waiting for the dev server at ${url}`);
}

async function waitForViteServer(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (viteServerUrl) {
      await waitForDevServer(viteServerUrl, Math.max(deadline - Date.now(), 1000));
      return;
    }

    await sleep(100);
  }

  throw new Error("Timed out waiting for the Vite dev server URL.");
}

function stopElectronProcess() {
  if (!electronProcess) {
    return;
  }

  const processToStop = electronProcess;
  electronProcess = null;

  if (!processToStop.killed) {
    processToStop.kill();
  }
}

function launchElectron() {
  stopElectronProcess();

  electronProcess = spawn(electronBinaryPath, ["."], {
    cwd: rootDir,
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      VITE_DEV_SERVER_URL: viteServerUrl ?? "http://127.0.0.1:5173"
    },
    stdio: "inherit"
  });

  electronHasStarted = true;

  electronProcess.on("exit", () => {
    if (!shuttingDown && electronProcess === null) {
      return;
    }

    if (!shuttingDown) {
      electronProcess = null;
    }
  });
}

function scheduleElectronRestart() {
  if (!electronHasStarted || shuttingDown || !electronBuildReady) {
    return;
  }

  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (!shuttingDown) {
      console.log("Electron files changed. Restarting desktop app...");
      launchElectron();
    }
  }, 250);
}

function startElectronWatcher() {
  if (electronWatcher || !fs.existsSync(electronOutputDir)) {
    return;
  }

  electronWatcher = fs.watch(electronOutputDir, (_eventType, fileName) => {
    if (fileName === "main.js" || fileName === "preload.js") {
      scheduleElectronRestart();
    }
  });

  electronWatcher.on("error", (error) => {
    if (!shuttingDown) {
      console.error(`Electron watcher failed: ${error.message}`);
    }
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  clearTimeout(restartTimer);

  if (electronWatcher) {
    electronWatcher.close();
    electronWatcher = null;
  }

  stopElectronProcess();
  for (const child of managedChildren) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => process.exit(exitCode), 150);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

spawnManaged(
  process.execPath,
  [viteCliPath],
  "Vite",
  (text) => {
    const match = stripAnsi(text).match(/Local:\s+(https?:\/\/\S+)/);
    if (match) {
      viteServerUrl = match[1];
    }
  }
);
spawnManaged(
  process.execPath,
  [tscCliPath, "-p", "tsconfig.electron.json", "--watch", "--preserveWatchOutput"],
  "TypeScript",
  (text) => {
    if (text.includes("Found 0 errors. Watching for file changes.")) {
      electronBuildReady = true;
    }
  }
);

async function main() {
  try {
    await Promise.all([
      waitForViteServer(),
      waitForFile(electronMainPath),
      waitForFile(electronPreloadPath)
    ]);

    while (!electronBuildReady) {
      await sleep(100);
    }

    if (shuttingDown) {
      return;
    }

    startElectronWatcher();
    launchElectron();
    console.log("Desktop dev environment is ready.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    shutdown(1);
  }
}

main();
