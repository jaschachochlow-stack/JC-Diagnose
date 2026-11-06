/* Nativer Verbindungsweg für die App (Android/Capacitor und Windows/Electron).
   Bietet: Bluetooth LE (Android), klassisches Bluetooth SPP (Android), WLAN-TCP (Android, Windows). */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { BleClient } from "@capacitor-community/bluetooth-le";
import { PromptSession, type ElmIo } from "./elm.ts";
import { BLE_OPTIONAL_SERVICES, chunkText, selectBleChannel, type BleService } from "./link.ts";

type Raw = {
  open(o: { kind: "spp" | "tcp"; address?: string; host?: string; port?: number }): Promise<number>;
  write(id: number, text: string): Promise<void>;
  close(id: number): Promise<void>;
  listBonded?(): Promise<{ name: string; address: string }[]>;
  onData(cb: (id: number, text: string) => void): void;
  onClosed(cb: (id: number) => void): void;
};

type CapPlugin = {
  listBonded(): Promise<{ devices: { name: string; address: string }[] }>;
  open(o: { kind: string; address?: string; host?: string; port?: number }): Promise<{ id: number }>;
  write(o: { id: number; text: string }): Promise<void>;
  close(o: { id: number }): Promise<void>;
  addListener(ev: string, cb: (d: { id: number; text?: string }) => void): Promise<unknown>;
};

type DesktopBridge = {
  tcpOpen(host: string, port: number): Promise<number>;
  write(id: number, text: string): Promise<void>;
  close(id: number): Promise<void>;
  onData(cb: (id: number, text: string) => void): void;
  onClosed(cb: (id: number) => void): void;
};

const sessions = new Map<number, PromptSession>();
const closers = new Map<number, () => void>();
let raw: Raw | null | undefined;

function getRaw(): Raw | null {
  if (raw !== undefined) return raw;
  raw = null;
  const g = globalThis as unknown as { JCDesktop?: DesktopBridge };
  if (g.JCDesktop) {
    const d = g.JCDesktop;
    raw = {
      open: (o) => (o.kind === "tcp" ? d.tcpOpen(o.host || "", o.port || 35000) : Promise.reject(new Error("Klassisches Bluetooth: am Rechner als COM-Port koppeln und „USB / COM“ wählen."))),
      write: (id, t) => d.write(id, t),
      close: (id) => d.close(id),
      onData: (cb) => d.onData(cb),
      onClosed: (cb) => d.onClosed(cb),
    };
  } else if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    const p = registerPlugin<CapPlugin>("JCLink");
    raw = {
      open: async (o) => (await p.open(o)).id,
      write: (id, text) => p.write({ id, text }),
      close: (id) => p.close({ id }),
      listBonded: async () => (await p.listBonded()).devices,
      onData: (cb) => void p.addListener("data", (d) => cb(d.id, d.text || "")),
      onClosed: (cb) => void p.addListener("closed", (d) => cb(d.id)),
    };
  }
  if (raw) {
    raw.onData((id, text) => sessions.get(id)?.pushText(text));
    raw.onClosed((id) => {
      sessions.delete(id);
      closers.get(id)?.();
    });
  }
  return raw;
}

export function nativeCaps(): { app: "android" | "desktop" | null; spp: boolean; tcp: boolean; ble: boolean } {
  const g = globalThis as unknown as { JCDesktop?: unknown };
  if (g.JCDesktop) return { app: "desktop", spp: false, tcp: true, ble: false };
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") return { app: "android", spp: true, tcp: true, ble: true };
  return { app: null, spp: false, tcp: false, ble: false };
}

export type Picker = (title: string, items: { id: string; label: string; sub?: string }[]) => Promise<string | null>;

function ioFor(r: Raw, id: number, session: PromptSession, timeoutDefault: number): ElmIo {
  sessions.set(id, session);
  return {
    send(command, timeoutMs = timeoutDefault) {
      return session.request((cmd) => r.write(id, cmd), command, timeoutMs);
    },
    async close() {
      closers.delete(id);
      sessions.delete(id);
      try { await r.close(id); } catch { /* */ }
    },
  };
}

/** WLAN-Adapter per rohem TCP (192.168.0.10:35000 u. ä.). Auf Android wird der Socket ans WLAN gebunden. */
export async function connectTcpNative(host: string, port: number): Promise<{ io: ElmIo; name: string }> {
  const r = getRaw();
  if (!r) throw new Error("TCP-Verbindung gibt es nur in der Android-App oder in der Windows-App.");
  const id = await r.open({ kind: "tcp", host, port });
  return { io: ioFor(r, id, new PromptSession(), 6000), name: "WLAN " + host + ":" + port };
}

/** Klassisches Bluetooth (SPP): gekoppeltes Gerät aus der Android-Liste wählen. */
export async function connectSppNative(pick: Picker): Promise<{ io: ElmIo; name: string }> {
  const r = getRaw();
  if (!r || !r.listBonded) throw new Error("Klassisches Bluetooth gibt es nur in der Android-App. Am Rechner: Adapter in Windows koppeln und „USB / COM“ wählen.");
  const list = await r.listBonded();
  if (!list.length) throw new Error("Kein gekoppeltes Bluetooth-Gerät gefunden. Zuerst in den Android-Einstellungen unter Bluetooth den ELM327 koppeln (PIN 1234 oder 0000), dann hier wählen.");
  const sel = await pick("Gekoppeltes Bluetooth-Gerät", list.map((d) => ({ id: d.address, label: d.name || d.address, sub: d.address })));
  if (!sel) throw new Error("Abgebrochen.");
  const id = await r.open({ kind: "spp", address: sel });
  const dev = list.find((d) => d.address === sel);
  return { io: ioFor(r, id, new PromptSession(), 6000), name: "Bluetooth " + (dev?.name || sel) };
}

/** Bluetooth LE über das native Android-Plugin (Web Bluetooth gibt es in der App-WebView nicht). */
export async function connectBleNative(): Promise<{ io: ElmIo; name: string }> {
  if (nativeCaps().app !== "android") throw new Error("Native BLE nur in der Android-App.");
  await BleClient.initialize({ androidNeverForLocation: true });
  const device = await BleClient.requestDevice({ optionalServices: BLE_OPTIONAL_SERVICES });
  const id = device.deviceId;
  const session = new PromptSession();
  await BleClient.connect(id, () => session.pushText(">"), { timeout: 10000 });
  const raw = await BleClient.getServices(id);
  const services: BleService[] = raw.map((s) => ({
    uuid: s.uuid,
    characteristics: s.characteristics.map((c) => ({
      uuid: c.uuid,
      properties: { write: !!c.properties.write, writeWithoutResponse: !!c.properties.writeWithoutResponse, notify: !!c.properties.notify },
    })),
  }));
  const ch = selectBleChannel(services);
  if (!ch) {
    await BleClient.disconnect(id);
    throw new Error("Kein serielles BLE-Profil gefunden (FFE0, FFF0, Nordic UART oder Vgate).");
  }
  const props = services.find((s) => s.uuid === ch.service)?.characteristics.find((c) => c.uuid === ch.write)?.properties;
  const dec = new TextDecoder();
  await BleClient.startNotifications(id, ch.service, ch.notify, (v) => {
    session.pushText(dec.decode(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)));
  });
  const enc = new TextEncoder();
  return {
    name: device.name || ch.profile,
    io: {
      send(command, timeoutMs = 6000) {
        return session.request(async (cmd) => {
          for (const part of chunkText(cmd, 20)) {
            const b = enc.encode(part);
            const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
            if (props?.writeWithoutResponse) await BleClient.writeWithoutResponse(id, ch.service, ch.write, dv);
            else await BleClient.write(id, ch.service, ch.write, dv);
          }
        }, command, timeoutMs);
      },
      async close() {
        try { await BleClient.disconnect(id); } catch { /* */ }
      },
    },
  };
}
