const { app, BrowserWindow, ipcMain, Menu, shell, protocol, net: enet } = require('electron');
const { pathToFileURL } = require('url');
const net = require('net');
const path = require('path');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);
const APP_DIR = path.join(__dirname, 'app');

let win = null;
let btCb = null;
let serCb = null;
const socks = new Map();
let nextId = 1;

function send(ch, ...a) { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); }

function createWindow() {
  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 420, minHeight: 600,
    backgroundColor: '#161a1f', title: 'JC Diagnose',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadURL('app://jc/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app:')) { e.preventDefault(); shell.openExternal(url); } });

  const ses = win.webContents.session;
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(true));
  ses.setPermissionCheckHandler(() => true);
  ses.setDevicePermissionHandler(() => true);
  // Bluetooth LE (Web Bluetooth): Geräteliste an die App geben
  win.webContents.on('select-bluetooth-device', (e, list, cb) => {
    e.preventDefault();
    btCb = cb;
    send('jc-pick', { kind: 'bluetooth', list: list.map((d) => ({ id: d.deviceId, name: d.deviceName || d.deviceId, sub: '' })) });
  });
  if (ses.setBluetoothPairingHandler) ses.setBluetoothPairingHandler((details, cb) => cb({ confirmed: true }));
  // COM-Ports (USB-ELM327, in Windows gekoppeltes klassisches Bluetooth)
  ses.on('select-serial-port', (e, ports, wc, cb) => {
    e.preventDefault();
    serCb = cb;
    send('jc-pick', { kind: 'serial', list: ports.map((p) => ({ id: p.portId, name: p.displayName || p.portName, sub: p.portName })) });
  });
}

ipcMain.on('jc-pick-result', (e, kind, id) => {
  if (kind === 'bluetooth') { if (btCb) btCb(id || ''); btCb = null; }
  else { if (serCb) serCb(id || ''); serCb = null; }
});

// WLAN-Adapter: rohes TCP (Browser können das nicht)
ipcMain.handle('jc-tcp-open', (e, host, port) => new Promise((resolve, reject) => {
  const s = new net.Socket();
  const id = nextId++;
  let done = false;
  const fail = (msg) => { if (!done) { done = true; reject(new Error(msg)); } };
  s.setTimeout(6000);
  s.once('connect', () => { done = true; s.setTimeout(0); s.setNoDelay(true); socks.set(id, s); resolve(id); });
  s.on('data', (b) => { if (!e.sender.isDestroyed()) e.sender.send('jc-tcp-data', id, b.toString('latin1')); });
  s.on('timeout', () => { s.destroy(); fail('WLAN-Adapter ' + host + ':' + port + ' antwortet nicht.'); });
  s.on('error', (err) => fail('WLAN-Adapter ' + host + ':' + port + ' nicht erreichbar (' + err.message + '). Mit dem WLAN des Adapters verbunden (Name oft „OBDII“, „WiFi_OBDII“, „V-LINK“)?'));
  s.on('close', () => { socks.delete(id); if (!e.sender.isDestroyed()) e.sender.send('jc-tcp-closed', id); });
  s.connect(port, host);
}));
ipcMain.handle('jc-tcp-write', (e, id, text) => new Promise((resolve, reject) => {
  const s = socks.get(id);
  if (!s) return reject(new Error('Verbindung ist getrennt.'));
  s.write(Buffer.from(text, 'latin1'), (err) => (err ? reject(err) : resolve()));
}));
ipcMain.handle('jc-tcp-close', (e, id) => { const s = socks.get(id); if (s) s.destroy(); socks.delete(id); });

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    // eigenes Schema statt file://, damit Web-Worker und WebAssembly (OCR, PDF) zuverlaessig laufen
    protocol.handle('app', (req) => {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p === '/' || p === '') p = '/index.html';
      const full = path.normalize(path.join(APP_DIR, p));
      if (!full.startsWith(APP_DIR + path.sep)) return new Response('forbidden', { status: 403 });
      return enet.fetch(pathToFileURL(full).toString());
    });
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
