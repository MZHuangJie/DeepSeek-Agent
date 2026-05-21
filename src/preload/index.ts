import { contextBridge, ipcRenderer } from 'electron';

const api = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  files: {
    list: (dirPath: string) => ipcRenderer.invoke('files:list', dirPath),
    read: (filePath: string) => ipcRenderer.invoke('files:read', filePath),
    cwd: () => ipcRenderer.invoke('files:cwd'),
    selectWorkspace: () => ipcRenderer.invoke('files:select-workspace'),
    setWorkspace: (workspacePath: string) => ipcRenderer.invoke('files:set-workspace', workspacePath),
    getRecentWorkspaces: () => ipcRenderer.invoke('files:get-recent'),
    removeRecentWorkspace: (p: string) => ipcRenderer.invoke('files:remove-recent', p),
    onTreeChanged: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('files:tree-changed', handler);
      return () => ipcRenderer.removeListener('files:tree-changed', handler);
    },
    createFile: (filePath: string) => ipcRenderer.invoke('files:create-file', filePath),
    createDirectory: (dirPath: string) => ipcRenderer.invoke('files:create-directory', dirPath),
    delete: (targetPath: string) => ipcRenderer.invoke('files:delete', targetPath),
    write: (filePath: string, content: string) => ipcRenderer.invoke('files:write', filePath, content),
    readBinary: (filePath: string) => ipcRenderer.invoke('files:readBinary', filePath),
    showInExplorer: (filePath: string) => ipcRenderer.invoke('files:show-in-explorer', filePath),
  },
  agent: {
    send: (messages: unknown) => ipcRenderer.invoke('agent:send', messages),
    cancel: () => ipcRenderer.invoke('agent:cancel'),
    onStreamChunk: (cb: (chunk: unknown) => void) => {
      const handler = (_: unknown, chunk: unknown) => cb(chunk);
      ipcRenderer.on('agent:stream-chunk', handler);
      return () => ipcRenderer.removeListener('agent:stream-chunk', handler);
    },
    onConfirmRequest: (cb: (req: any) => void) => {
      const handler = (_: unknown, req: any) => cb(req);
      ipcRenderer.on('agent:confirm-request', handler);
      return () => ipcRenderer.removeListener('agent:confirm-request', handler);
    },
    confirmResponse: (confirmId: string, approved: boolean) => {
      ipcRenderer.send('agent:confirm-response', { confirmId, approved });
    },
    onChoiceRequest: (cb: (req: any) => void) => {
      const handler = (_: unknown, req: any) => cb(req);
      ipcRenderer.on('agent:choice-request', handler);
      return () => ipcRenderer.removeListener('agent:choice-request', handler);
    },
    choiceResponse: (choiceId: string, selected: number[], feedback: string, cancelled: boolean) => {
      ipcRenderer.send('agent:choice-response', { choiceId, selected, feedback, cancelled });
    },
  },
  terminal: {
    create: (shell?: string) => ipcRenderer.invoke('terminal:create', shell),
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    destroy: (id: string) => ipcRenderer.invoke('terminal:destroy', id),
    onData: (id: string, cb: (data: string) => void) => {
      const handler = (_: unknown, data: { id: string; output: string }) => {
        if (data.id === id) cb(data.output);
      };
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    getApiKey: () => ipcRenderer.invoke('settings:getApiKey'),
    setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
  },
  sessions: {
    save: (id: string, title: string, messages: string) => ipcRenderer.invoke('sessions:save', id, title, messages),
    loadAll: () => ipcRenderer.invoke('sessions:loadAll'),
    delete: (id: string) => ipcRenderer.invoke('sessions:delete', id),
  },
  marketplace: {
    add: (url: string) => ipcRenderer.invoke('marketplace:add', url),
    remove: (id: string) => ipcRenderer.invoke('marketplace:remove', id),
    list: () => ipcRenderer.invoke('marketplace:list'),
  },
  plugins: {
    discover: () => ipcRenderer.invoke('plugin:discover'),
    install: (meta: { name: string; source: string; downloadUrl: string }) => ipcRenderer.invoke('plugin:install', meta),
    uninstall: (name: string) => ipcRenderer.invoke('plugin:uninstall', name),
    listInstalled: () => ipcRenderer.invoke('plugin:list-installed'),
    getErrors: () => ipcRenderer.invoke('plugin:get-errors'),
    clearErrors: () => ipcRenderer.invoke('plugin:clear-errors'),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type API = typeof api;
