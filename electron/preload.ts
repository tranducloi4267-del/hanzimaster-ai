import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  isElectron: true;
  platform: string;
  synthesizeEdgeTts: (options: {
    text: string;
    voice?: string;
    rate?: number;
  }) => Promise<string>;
  isSecureStorageAvailable: () => Promise<boolean>;
  encryptSecret: (plainText: string) => Promise<string>;
  decryptSecret: (payload: string) => Promise<string>;
}

const api: ElectronAPI = {
  isElectron: true,
  platform: process.platform,
  synthesizeEdgeTts: (options) => ipcRenderer.invoke('edge-tts:synthesize', options),
  isSecureStorageAvailable: () => ipcRenderer.invoke('secure-storage:is-available'),
  encryptSecret: (plainText) => ipcRenderer.invoke('secure-storage:encrypt', plainText),
  decryptSecret: (payload) => ipcRenderer.invoke('secure-storage:decrypt', payload)
};

contextBridge.exposeInMainWorld('electronAPI', api);
