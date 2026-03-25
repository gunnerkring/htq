import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SaveCsvPayload = {
  suggestedName: string;
  content: string;
};

type SavePdfPayload = {
  suggestedName: string;
  html: string;
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (app.isPackaged) {
    const indexPath = path.join(app.getAppPath(), "dist", "index.html");
    win.loadFile(indexPath);
  } else {
    win.loadURL(process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173");
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/*
OPEN WORKBOOK DIALOG
*/

ipcMain.handle("dialog:openWorkbook", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [
      { name: "Excel Workbook", extensions: ["xlsx", "xlsm"] }
    ]
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const bytes = Array.from(await readFile(filePath));

  return {
    fileName: path.basename(filePath),
    filePath,
    bytes
  };
});

ipcMain.handle("dialog:saveCsv", async (_event, payload: SaveCsvPayload) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.suggestedName,
    filters: [
      { name: "CSV File", extensions: ["csv"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  await writeFile(result.filePath, payload.content, "utf8");

  return {
    saved: true,
    filePath: result.filePath
  };
});

ipcMain.handle("dialog:savePdf", async (_event, payload: SavePdfPayload) => {
  const result = await dialog.showSaveDialog({
    defaultPath: payload.suggestedName,
    filters: [
      { name: "PDF File", extensions: ["pdf"] }
    ]
  });

  if (result.canceled || !result.filePath) {
    return { saved: false };
  }

  const reportWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  });

  try {
    await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);
    const pdfBuffer = await reportWindow.webContents.printToPDF({
      landscape: true,
      printBackground: true,
      pageSize: "Letter",
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.35,
        right: 0.35
      }
    });

    await writeFile(result.filePath, pdfBuffer);

    return {
      saved: true,
      filePath: result.filePath
    };
  } finally {
    reportWindow.destroy();
  }
});
