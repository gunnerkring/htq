import { contextBridge, ipcRenderer } from "electron";

const api = {
  openWorkbook: async () => {
    return await ipcRenderer.invoke("dialog:openWorkbook");
  },
  saveCsv: async (payload: { suggestedName: string; content: string }) => {
    return await ipcRenderer.invoke("dialog:saveCsv", payload);
  },
  savePdf: async (payload: { suggestedName: string; html: string }) => {
    return await ipcRenderer.invoke("dialog:savePdf", payload);
  }
};

contextBridge.exposeInMainWorld("htqApi", api);
contextBridge.exposeInMainWorld("electronAPI", api);
