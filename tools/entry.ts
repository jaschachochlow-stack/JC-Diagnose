/* JC Diagnose: Bündel aus eigenem kfz-diagnose-Code (OBD + Scope-Kurven) als globales window.JCX */
import { traces } from "./kfz/scope.ts";
import { PROTOCOLS, protocolGroups, protocolById } from "./obd/protocols.ts";
import { initAdapter, readAllDtcs, clearDtcs, readLive, createDemoElm, PromptSession, type ElmIo } from "./obd/elm.ts";
import { connectBluetooth, bluetoothUnavailableReason } from "./obd/bluetooth.ts";
import { nativeCaps, connectTcpNative, connectSppNative, connectBleNative } from "./obd/native.ts";
import { connectWifi, parseWifiTarget, hasWebBluetooth, hasTcpSocket } from "./obd/link.ts";

/** USB- oder per Bluetooth gekoppelte ELM327 als COM-Port (Chrome/Edge am Rechner, Web Serial). */
export function serialUnavailableReason(): string | null {
  const nav = navigator as Navigator & { serial?: unknown };
  if (!nav.serial) return "Web Serial fehlt: nur Chrome oder Edge am Rechner (Windows, macOS, Linux).";
  return null;
}
export async function connectSerial(baud = 38400): Promise<{ io: ElmIo; name: string }> {
  const r = serialUnavailableReason();
  if (r) throw new Error(r);
  type Port = { open(o: { baudRate: number }): Promise<void>; close(): Promise<void>; readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array>; getInfo?(): { usbVendorId?: number } };
  const nav = navigator as unknown as { serial: { requestPort(): Promise<Port> } };
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: baud });
  const session = new PromptSession();
  const reader = port.readable.getReader();
  const writer = port.writable.getWriter();
  let alive = true;
  (async () => {
    const dec = new TextDecoder();
    while (alive) {
      try {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) session.pushText(dec.decode(value));
      } catch { break; }
    }
  })();
  const enc = new TextEncoder();
  return {
    name: "Serial " + baud + " Bd",
    io: {
      send(command, timeoutMs = 6000) {
        return session.request(async (cmd) => { await writer.write(enc.encode(cmd)); }, command, timeoutMs);
      },
      async close() {
        alive = false;
        try { await reader.cancel(); } catch { /* */ }
        try { reader.releaseLock(); writer.releaseLock(); } catch { /* */ }
        try { await port.close(); } catch { /* */ }
      },
    },
  };
}

export {
  traces, PROTOCOLS, protocolGroups, protocolById, initAdapter, readAllDtcs, clearDtcs, readLive, createDemoElm,
  nativeCaps, connectTcpNative, connectSppNative, connectBleNative,
  connectBluetooth, bluetoothUnavailableReason, connectWifi, parseWifiTarget, hasWebBluetooth, hasTcpSocket,
};
