const GOOD = "#2ee6c7";
const BAD = "#ff5d6c";
const MID = "#7eb6ff";

function clamp(v: number): number {
  return Math.max(0.02, Math.min(0.98, v));
}

function line(ys: Array<number | null>, color: string, width = 2.4): string {
  const x0 = 36;
  const x1 = 688;
  const y0 = 34;
  const y1 = 236;
  let parts = "";
  let pts: string[] = [];
  const flush = () => {
    if (pts.length > 1) {
      parts += `<polyline fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" points="${pts.join(" ")}"/>`;
    }
    pts = [];
  };
  ys.forEach((y, i) => {
    if (y == null || Number.isNaN(y)) {
      flush();
      return;
    }
    const x = x0 + ((x1 - x0) * i) / (ys.length - 1);
    const yy = y0 + (1 - clamp(y)) * (y1 - y0);
    pts.push(`${x.toFixed(1)},${yy.toFixed(1)}`);
  });
  flush();
  return parts;
}

function samples(fn: (t: number) => number | null, n = 280): Array<number | null> {
  return Array.from({ length: n }, (_, i) => fn(i / (n - 1)));
}

function sine(t: number, cycles: number, amp: number, mid: number): number {
  return mid + Math.sin(t * Math.PI * 2 * cycles) * amp;
}

function square(t: number, cycles: number, lo: number, hi: number, duty = 0.5): number {
  const p = (t * cycles) % 1;
  return p < duty ? hi : lo;
}


/** JC Diagnose: physikalisch korrigierte Kurven (überschreiben die alten Fälle). y: 0 = unten, 1 = oben. */
function fixed(kind: string, good: (fn: (t: number) => number | null) => string, bad: (fn: (t: number) => number | null, w?: number) => string, mid: (fn: (t: number) => number | null) => string): string | null {
  const lerp = (a: number, b: number, x: number) => a + (b - a) * Math.max(0, Math.min(1, x));
  const ease = (x: number) => 1 - Math.exp(-Math.max(0, x));
  // Geberrad 60-2: Zahnlücke als fehlende Perioden mit größerem Ausschlag an den Rändern
  const toothed = (t: number, teeth: number, amp: number, mid0: number, gapAt: number) => {
    const ph = t * teeth, k = Math.floor(ph) % 30;
    if (Math.abs(t - gapAt) < 0.035) return mid0 + (t < gapAt ? 1 : -1) * amp * 1.5 * Math.sin(((t - gapAt + 0.035) / 0.07) * Math.PI);
    void k;
    return mid0 + Math.sin(ph * Math.PI * 2) * amp;
  };
  switch (kind) {
    case "inductive":
      return good((t) => toothed(t, 22, 0.16 + t * 0.2, 0.55, 0.62)) + bad((t) => toothed(t, 22, 0.06, 0.55, 0.62));
    case "sync":
      // oben NW (blau), unten KW-Hall mit Zahnlücke (grün); rot: NW-Flanke verschoben
      return mid((t) => (((t + 0.02) % 0.5) < 0.12 ? 0.92 : 0.66)) +
        good((t) => (Math.abs(t - 0.24) < 0.03 || Math.abs(t - 0.74) < 0.03 ? 0.14 : square(t, 26, 0.14, 0.44, 0.5))) +
        bad((t) => ((((t + 0.09) % 0.5) < 0.12) ? 0.92 : 0.66), 1.6);
    case "ramp":
      return good((t) => 0.12 + Math.sin(t * Math.PI) * 0.74) +
        bad((t) => (Math.abs(t - 0.3) < 0.012 || Math.abs(t - 0.62) < 0.01 ? 0.05 : 0.12 + Math.sin(t * Math.PI) * 0.74 - 0.012));
    case "maf":
      return good((t) => (t < 0.25 ? 0.2 : t < 0.32 ? lerp(0.2, 0.86, (t - 0.25) / 0.07) : t < 0.36 ? lerp(0.86, 0.74, (t - 0.32) / 0.04) : t < 0.6 ? 0.74 : t < 0.66 ? lerp(0.74, 0.14, (t - 0.6) / 0.06) : t < 0.72 ? lerp(0.14, 0.2, (t - 0.66) / 0.06) : 0.2)) +
        bad((t) => (t < 0.25 ? 0.2 : t < 0.6 ? 0.2 + ease((t - 0.25) * 8) * 0.34 : 0.2 + (0.2 + ease(2.8) * 0.34 - 0.2) * Math.exp(-(t - 0.6) * 9)));
    case "freq":
      return good((t) => { const f = 8 + t * 22; return ((t * f) % 1) < 0.5 ? 0.78 : 0.24; }) + bad((t) => (t < 0.45 ? null : square(t, 12, 0.24, 0.78) - 0.02), 1.8);
    case "map":
      // Zündung ein: Umgebungsdruck hoch, Leerlauf: Unterdruck niedrig, Gasstoß: kurz hoch
      return good((t) => (t < 0.15 ? 0.82 : t < 0.2 ? lerp(0.82, 0.3, (t - 0.15) / 0.05) : t < 0.5 ? 0.3 : t < 0.53 ? lerp(0.3, 0.8, (t - 0.5) / 0.03) : t < 0.6 ? lerp(0.8, 0.22, (t - 0.53) / 0.07) : t < 0.7 ? lerp(0.22, 0.3, (t - 0.6) / 0.1) : 0.3)) +
        bad((t) => (t < 0.5 ? null : t < 0.62 ? 0.3 + ease((t - 0.5) * 14) * 0.24 : 0.3 + 0.24 * Math.exp(-(t - 0.62) * 8)), 2);
    case "rail":
      return good((t) => (t < 0.2 ? 0.35 : t < 0.26 ? lerp(0.35, 0.8, (t - 0.2) / 0.06) : t < 0.36 ? 0.8 : t < 0.42 ? lerp(0.8, 0.35, (t - 0.36) / 0.06) : t < 0.6 ? 0.35 : 0.06 + 0.29 * Math.exp(-(t - 0.6) * 3.2))) +
        bad((t) => (t < 0.6 ? null : 0.06 + 0.29 * Math.exp(-(t - 0.6) * 22)));
    case "egt":
      return good((t) => 0.18 + Math.pow(t, 1.2) * 0.5) +
        bad((t) => { const b = 0.18 + Math.pow(t, 1.2) * 0.5 - 0.015; if (t > 0.8) return 0.96; if (Math.abs(t - 0.36) < 0.006) return b + 0.3; if (Math.abs(t - 0.55) < 0.006) return b - 0.2; return t > 0.3 ? b : null; });
    case "inj":
      // masseseitig: Bordspannung ~0.32, Ansteuerung ~0.05, Induktionsspitze ~0.95, kleine Nadelschließ-Welle
      return good((t) => (t < 0.3 ? 0.32 : t < 0.52 ? 0.05 : t < 0.535 ? 0.95 : t < 0.56 ? lerp(0.6, 0.36, (t - 0.535) / 0.025) : t < 0.6 ? 0.36 + Math.sin((t - 0.56) / 0.04 * Math.PI) * 0.05 : 0.32)) +
        mid((t) => (t < 0.3 ? 0.04 : t < 0.52 ? 0.04 + ease((t - 0.3) * 18) * 0.18 + (t > 0.38 && t < 0.4 ? -0.015 : 0) : t < 0.54 ? lerp(0.22, 0.04, (t - 0.52) / 0.02) : 0.04)) +
        bad((t) => (t < 0.51 ? null : t < 0.535 ? 0.5 : t < 0.6 ? 0.33 : null));
    case "gdi":
      // Strom: schneller Anstieg (Boost), Spitze, Haltephase mit Stromregelung (Zacken), Abschalten
      return good((t) => (t < 0.25 ? 0.05 : t < 0.31 ? lerp(0.05, 0.9, (t - 0.25) / 0.06) : t < 0.34 ? lerp(0.9, 0.42, (t - 0.31) / 0.03) : t < 0.62 ? 0.38 + (((t - 0.34) * 60) % 1) * 0.08 : t < 0.64 ? lerp(0.42, 0.05, (t - 0.62) / 0.02) : 0.05)) +
        bad((t) => (t < 0.33 ? null : t < 0.36 ? lerp(0.5, 0.05, (t - 0.33) / 0.03) : t < 0.64 ? 0.05 : null));
    case "cr": {
      const pulse = (t: number, a: number, w: number, h: number) => (t < a ? null : t < a + 0.015 ? lerp(0.05, h, (t - a) / 0.015) : t < a + w ? h * 0.55 + (((t - a) * 80) % 1) * 0.05 : t < a + w + 0.01 ? lerp(h * 0.55, 0.05, (t - a - w) / 0.01) : null);
      const g = (t: number) => pulse(t, 0.12, 0.05, 0.55) ?? pulse(t, 0.3, 0.16, 0.9) ?? pulse(t, 0.6, 0.05, 0.55) ?? 0.05;
      return good(g) + bad((t) => (t >= 0.3 && t < 0.48 ? 0.05 : null));
    }
    case "coil":
      // Primärstrom: Rampe während Schließzeit, Strombegrenzung (flach), Abschalten auf 0
      return good((t) => (t < 0.2 ? 0.06 : t < 0.52 ? lerp(0.06, 0.78, (t - 0.2) / 0.32) : t < 0.66 ? 0.78 : t < 0.67 ? lerp(0.78, 0.06, (t - 0.66) / 0.01) : 0.06)) +
        bad((t) => (t < 0.2 ? null : t < 0.34 ? lerp(0.06, 0.78, (t - 0.2) / 0.14) : t < 0.66 ? 0.8 : null));
    case "pwm":
      // Spannung masseseitig: aus = Bordspannung (hoch), ein = ~0 V; Strom (blau) als Sägezahn
      return good((t) => { const p = (t * 9) % 1; return p < 0.4 ? 0.5 : 0.92; }) +
        mid((t) => { const p = (t * 9) % 1; return p < 0.4 ? 0.12 + p * 0.25 : 0.22 - (p - 0.4) * 0.17; }) +
        bad((t) => (t < 0.55 ? null : ((t * 9) % 1) < 0.4 ? 0.66 : 0.92), 1.8);
    case "pump":
      return good((t) => 0.46 + Math.abs(Math.sin(t * Math.PI * 16)) * 0.22) +
        bad((t) => { const k = Math.floor(t * 16); return k % 5 === 2 ? 0.46 + Math.abs(Math.sin(t * Math.PI * 16)) * 0.07 : null; });
    case "clamp":
      // Einschaltstrom-Spitze, Laststrom, Abschalten; rot: dauerhaft erhöhter Strom
      return good((t) => (t < 0.15 ? 0.06 : t < 0.18 ? lerp(0.06, 0.9, (t - 0.15) / 0.03) : t < 0.7 ? 0.42 + 0.48 * Math.exp(-(t - 0.18) * 20) + Math.sin(t * 160) * 0.01 : t < 0.72 ? lerp(0.42, 0.06, (t - 0.7) / 0.02) : 0.06)) +
        bad((t) => (t < 0.25 || t > 0.7 ? null : 0.64 + Math.sin(t * 160) * 0.012));
    case "drop":
      // Spannungsfall über Masse/Leitung: ohne Last ~0, unter Last grün klein, rot groß
      return good((t) => (t < 0.25 || t > 0.72 ? 0.08 : 0.16)) + bad((t) => (t < 0.25 || t > 0.72 ? null : 0.62 + Math.sin(t * 90) * 0.02));
    case "crankv": {
      const g = (t: number) => (t < 0.12 ? 0.62 : t < 0.15 ? lerp(0.62, 0.22, (t - 0.12) / 0.03) : t < 0.2 ? lerp(0.22, 0.4, (t - 0.15) / 0.05) : t < 0.66 ? 0.42 + Math.abs(Math.sin((t - 0.2) * Math.PI * 22)) * 0.06 : t < 0.72 ? lerp(0.45, 0.82, (t - 0.66) / 0.06) : 0.8);
      return good(g) + bad((t) => (t < 0.15 || t > 0.66 ? null : t < 0.2 ? lerp(0.06, 0.22, (t - 0.15) / 0.05) : 0.22 + Math.abs(Math.sin((t - 0.2) * Math.PI * 22)) * 0.05));
    }
    case "relcomp":
      return good((t) => 0.2 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.6) + bad((t) => (Math.floor(t * 4) === 2 && Math.sin(t * Math.PI * 8) > 0 ? 0.2 + Math.sin(t * Math.PI * 8) * 0.25 : null));
    case "exhaust":
      return good((t) => 0.3 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.42) + bad((t) => (Math.floor(t * 4) === 2 ? 0.3 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.08 : null));
    case "absind":
      // Impulsring ohne Lücke: Amplitude und Frequenz steigen mit der Geschwindigkeit; rot: beschädigter Zahn
      return good((t) => { const ph = t * (14 + t * 10); return 0.55 + Math.sin(ph * Math.PI * 2) * (0.08 + t * 0.24); }) +
        bad((t) => { const ph = t * (14 + t * 10); const a = (0.08 + t * 0.24) * 0.95; return Math.abs(t - 0.58) < 0.02 ? 0.55 + Math.sin(ph * Math.PI * 2) * a * 0.2 : (t > 0.5 && t < 0.66 ? 0.55 + Math.sin(ph * Math.PI * 2) * a : null); });
    case "lin":
      // Ruhe rezessiv ~ Bordspannung (oben), Break 13 Bit dominant (unten), Sync 0x55, Daten; rot: Leitung auf Masse
      return good((t) => { if (t < 0.08) return 0.82; if (t < 0.2) return 0.14; if (t < 0.22) return 0.82; if (t < 0.4) return ((t - 0.22) * 55) % 2 < 1 ? 0.14 : 0.82; const p = (t * 37) % 3; return p < 1.1 ? 0.14 : 0.82; }) +
        bad((t) => (t > 0.6 ? 0.14 : null));
    default:
      return null;
  }
}
export function traces(kind: string): string {
  const good = (fn: (t: number) => number | null) => line(samples(fn, 600), GOOD);
  const bad = (fn: (t: number) => number | null, width = 2.2) => line(samples(fn, 600), BAD, width);
  const mid = (fn: (t: number) => number | null) => line(samples(fn, 600), MID, 1.8);
  const fx = fixed(kind, good, bad, mid);
  if (fx) return fx;
  switch (kind) {
    case "meter":
      return good((t) => 0.72 - t * 0.22 + (t > 0.46 && t < 0.54 ? -0.34 : 0)) + bad((t) => 0.66 - t * 0.16);
    case "probe":
      return good((t) => 0.55 + Math.sin(t * 18) * 0.22) + bad((t) => (t < 0.18 || t > 0.82 ? 0.16 : null));
    case "scale":
      return good((t) => sine(t, 6, 0.32, 0.52)) + bad((t) => {
        const step = Math.floor(t * 18) / 18;
        return sine(step, 6, 0.16, 0.28);
      });
    case "noise":
      return (
        good((t) => square(t, 8, 0.3, 0.76)) +
        bad((t) => {
          const spike = Math.sin(t * 70) > 0.78 ? 0.2 : Math.sin(t * 36) < -0.88 ? -0.18 : 0;
          return spike === 0 ? null : square(t, 8, 0.3, 0.76) + spike;
        })
      );
    case "clamp":
      return good((t) => 0.42 + (Math.sin(t * Math.PI * 10) > 0 ? 0.26 : 0)) + bad((t) => 0.42 - (Math.sin(t * Math.PI * 10) > 0 ? 0.22 : 0));
    case "drop":
      return good((t) => (t > 0.22 && t < 0.74 ? 0.62 : 0.78)) + bad((t) => (t > 0.28 && t < 0.7 ? 0.22 : 0.74));
    case "inductive":
    case "gap":
    case "absind":
      return (
        good((t) => {
          const grow = kind === "inductive" ? 0.55 + t * 0.85 : 1;
          const gap = Math.abs(t - 0.72) < 0.04;
          const edge = Math.abs(Math.abs(t - 0.72) - 0.055) < 0.018 ? 1.4 : 1;
          return sine(t, 16, (gap ? 0.04 : 0.28) * grow * edge, 0.55);
        }) +
        bad((t) => {
          const hole = Math.abs(t - 0.38) < 0.035;
          return hole ? 0.42 : sine(t, 16, 0.1, 0.42);
        })
      );
    case "hall":
      return good((t) => square(t, 7, 0.18, 0.82)) + bad((t) => (Math.abs(t - 0.48) < 0.07 ? 0.82 : square(t, 7, 0.42, 0.82)));
    case "direction":
      return (
        good((t) => {
          const p = (t * 8) % 1;
          const w = Math.floor(t * 8) % 2 === 0 ? 0.1 : 0.26;
          return p < w ? 0.8 : 0.22;
        }) +
        bad((t) => {
          const p = (t * 8) % 1;
          return p < 0.16 ? 0.48 : 0.22;
        })
      );
    case "sync":
      return mid((t) => square(t, 5, 0.62, 0.9, 0.16)) + good((t) => square(t, 10, 0.16, 0.46, 0.32)) + bad((t) => (t > 0.42 && t < 0.58 ? 0.46 : null));
    case "vvt":
      return mid((t) => square(t, 5, 0.62, 0.9, 0.16)) + good((t) => square(t + 0.04, 10, 0.16, 0.46, 0.32)) + bad((t) => square(t + 0.16, 10, 0.16, 0.46, 0.32));
    case "ramp":
      return good((t) => 0.16 + Math.pow(Math.sin(t * Math.PI), 1.1) * 0.7) + bad((t) => (t > 0.34 && t < 0.46 ? 0.28 : t > 0.6 && t < 0.68 ? 0.34 : null));
    case "dual":
      return good((t) => 0.16 + t * 0.7) + mid((t) => 0.86 - t * 0.66) + bad((t) => (t > 0.45 ? 0.16 + 0.45 * 0.7 : null));
    case "pedal":
      return good((t) => 0.18 + t * 0.62) + mid((t) => 0.22 + t * 0.3) + bad((t) => (t > 0.55 ? 0.22 + 0.55 * 0.3 + (t - 0.55) * 0.9 : null));
    case "maf":
      return (
        good((t) => (t < 0.22 ? 0.24 : t < 0.42 ? 0.24 + (t - 0.22) * 3 : t < 0.68 ? 0.84 - (t - 0.42) * 1.5 : 0.28)) +
        bad((t) => (t < 0.22 ? 0.24 : t < 0.5 ? 0.24 + (t - 0.22) * 1.1 : 0.55))
      );
    case "freq":
    case "fp":
      return good((t) => square(t, kind === "fp" ? 5 + t * 12 : 14, 0.32, 0.74)) + bad((t) => (t < 0.55 ? null : square(t, 4, 0.28, 0.5)));
    case "map":
      return good((t) => (t < 0.28 ? 0.8 : t < 0.68 ? 0.34 : 0.76)) + bad((t) => (t < 0.28 ? 0.8 : 0.8 - (t - 0.28) * 0.35));
    case "rail":
      return good((t) => (t < 0.58 ? 0.72 : 0.72 - (t - 0.58) * 0.55)) + bad((t) => (t < 0.42 ? null : 0.7 - (t - 0.42) * 1.35));
    case "lambda":
      return good((t) => square(t, 3.4, 0.22, 0.8, 0.48)) + bad((t) => (t < 0.5 ? square(t, 1.4, 0.34, 0.62, 0.7) : 0.78));
    case "wide":
      return mid(() => 0.58) + good((t) => 0.52 + Math.tanh((t - 0.32) * 8) * 0.2 - Math.tanh((t - 0.68) * 10) * 0.26) + bad((t) => (t < 0.4 ? null : 0.9));
    case "heater":
      return good((t) => square(t, 14, 0.28, 0.78, Math.max(0.08, 0.78 - t * 0.6))) + bad((t) => (t > 0.45 ? 0.78 : null));
    case "knock":
      return (
        good((t) => {
          const burst = (center: number, amp: number) => {
            const d = Math.abs(t - center);
            return d < 0.07 ? Math.sin(d * 220) * Math.exp(-d * 26) * amp : 0;
          };
          return 0.5 + burst(0.28, 1.6) + burst(0.68, 1.35);
        }) +
        bad((t) => {
          const d = Math.abs(t - 0.48);
          return 0.5 + (d < 0.05 ? Math.sin(d * 180) * 0.12 : 0);
        })
      );
    case "ntc":
      return (
        good((t) => 0.84 - Math.pow(t, 0.85) * 0.52) +
        bad((t) => (t < 0.34 ? null : t < 0.36 ? 0.84 - Math.pow(0.34, 0.85) * 0.52 : 0.96)) +
        bad((t) => (t < 0.68 ? null : t < 0.7 ? 0.84 - Math.pow(0.68, 0.85) * 0.52 : 0.04))
      );
    case "egt":
      return (
        good((t) => 0.22 + Math.pow(t, 1.15) * 0.5) +
        bad((t) => {
          const base = (at: number) => 0.22 + Math.pow(at, 1.15) * 0.5;
          if (Math.abs(t - 0.38) < 0.018) return base(0.38) + 0.26;
          if (Math.abs(t - 0.55) < 0.014) return base(0.55) + 0.22;
          if (t > 0.74) return 0.95;
          return null;
        }) +
        bad((t) => (t > 0.86 ? 0.05 : null))
      );
    case "inj":
      return (
        good((t) => (t > 0.3 && t < 0.5 ? 0.1 : t > 0.5 && t < 0.56 ? 0.94 : 0.74)) +
        mid((t) => (t > 0.32 && t < 0.5 ? 0.28 + (t - 0.32) * 2.4 : t > 0.5 && t < 0.56 ? 0.55 : 0.18)) +
        bad((t) => (t > 0.5 && t < 0.62 ? 0.22 : null))
      );
    case "gdi":
    case "cr":
      return (
        good((t) => {
          const pulses = kind === "cr" ? [0.16, 0.34, 0.54] : [0.32];
          let y = 0.2;
          for (const p of pulses) {
            if (t > p && t < p + 0.05) y = 0.9 - ((t - p) / 0.05) * 0.28;
            else if (t >= p + 0.05 && t < p + 0.14) y = 0.48;
          }
          return y;
        }) +
        bad((t) => {
          const p = kind === "cr" ? 0.34 : 0.32;
          return t > p && t < p + 0.14 ? 0.2 : null;
        })
      );
    case "pwm":
      return good((t) => square(t, 10, 0.22, 0.8, 0.35)) + mid((t) => 0.34 + square(t, 10, 0, 0.2, 0.35)) + bad((t) => (t > 0.52 && t < 0.78 ? 0.8 : null));
    case "coil":
      return good((t) => (t < 0.18 || t > 0.78 ? 0.2 : t < 0.62 ? 0.2 + (t - 0.18) * 1.2 : t < 0.68 ? 0.92 : 0.2)) + bad((t) => (t > 0.2 && t < 0.75 ? 0.2 : null));
    case "absact":
      return good((t) => square(t, 9, 0.4, 0.64)) + bad((t) => (Math.abs(t - 0.5) < 0.06 ? 0.4 : square(t, 9, 0.52, 0.64)));
    case "ak":
      return (
        good((t) => {
          const p = (t * 4) % 1;
          if (p < 0.12) return 0.86;
          if (p < 0.42) return square(t * 3, 8, 0.34, 0.56, 0.5);
          return 0.3;
        }) +
        bad((t) => {
          const n = Math.floor(t * 4);
          if (n !== 2) return null;
          const p = (t * 4) % 1;
          return p < 0.42 ? 0.3 : null;
        })
      );
    case "gear":
      return good((t) => square(t, t < 0.5 ? 6 : 11, 0.58, 0.86, 0.4)) + mid((t) => square(t, 8, 0.16, 0.4, 0.4)) + bad((t) => (t > 0.6 && t < 0.78 ? 0.58 : null));
    case "pump":
      return good((t) => 0.48 + Math.abs(Math.sin(t * Math.PI * 16)) * 0.22) + bad((t) => (t > 0.4 && t < 0.58 ? 0.36 : null));
    case "crankv":
      return good((t) => (t > 0.16 && t < 0.72 ? 0.5 : 0.78)) + bad((t) => (t > 0.2 && t < 0.68 ? 0.18 : 0.72));
    case "relcomp":
      return good((t) => 0.28 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.55) + bad((t) => (Math.floor(t * 8) === 3 ? 0.28 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.22 : null));
    case "cyl":
      return good((t) => 0.26 + Math.exp(-Math.pow((t - 0.4) * 8, 2)) * 0.64) + bad((t) => 0.26 + Math.exp(-Math.pow((t - 0.62) * 8, 2)) * 0.28);
    case "exhaust":
      return good((t) => 0.32 + Math.max(0, Math.sin(t * Math.PI * 8)) * 0.42) + bad((t) => (Math.floor(t * 8) === 5 ? 0.32 : null));
    case "alt":
      return good((t) => 0.62 + Math.abs(Math.sin(t * Math.PI * 18)) * 0.08) + bad((t) => 0.48 + Math.sin(t * 40) * 0.16 - (Math.floor(t * 10) % 4 === 2 ? 0.18 : 0));
    case "can":
      return good((t) => square(t, 16, 0.55, 0.78, 0.4)) + mid((t) => square(t, 16, 0.55, 0.28, 0.4)) + bad((t) => (t > 0.62 ? square(t, 16, 0.48, 0.7, 0.4) : null)) + bad((t) => (t > 0.62 ? square(t, 16, 0.48, 0.34, 0.4) : null), 1.6);
    case "lin":
      return good((t) => (t < 0.12 ? 0.18 : square(t, 12, 0.22, 0.8, 0.45))) + bad((t) => (t > 0.55 ? 0.18 : null));
    case "sent":
      return (
        good((t) => {
          const p = (t * 8) % 1;
          const w = 0.15 + (Math.floor(t * 8) % 4) * 0.08;
          return p < w ? 0.78 : 0.24;
        }) +
        bad((t) => (t < 0.55 ? null : (t * 8) % 1 < 0.2 ? 0.78 : 0.24))
      );
    case "psi":
      return good((t) => 0.48 + square(t, 18, 0, 0.14, 0.45)) + bad((t) => (t > 0.5 ? 0.48 : null));
    case "codes":
    case "summary":
      return good((t) => 0.55 + Math.sin(t * Math.PI * 8) * 0.24) + bad((t) => 0.4 + Math.sin(t * Math.PI * 8 + 0.6) * 0.08);
    default:
      return good((t) => sine(t, 5, 0.28, 0.55)) + bad((t) => (t > 0.45 && t < 0.62 ? 0.2 : null));
  }
}

const CAPTION: Record<string, string> = {
  meter: "Мультиметр усредняет, осциллограф видит провал",
  probe: "Щуп сзади разъёма, масса рядом с датчиком",
  ntc: "Температура: плавный спад, обрыв вверх, замыкание в ноль",
  inductive: "Индуктивный датчик: амплитуда и пропуск",
  hall: "Прямоугольник 0–5 В, приподнятая полка — плохая масса",
  lambda: "Переключение бедной и богатой смеси",
  can: "CAN-H и CAN-L зеркально",
};

const MARK: Record<string, string> = {
  ntc: `<text x="230" y="58" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">обрыв → 5 В</text><text x="470" y="228" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">замыкание → 0</text>`,
  egt: `<text x="250" y="58" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">иглы, обрыв</text><text x="560" y="228" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">КЗ → 0</text>`,
  inductive: `<text x="250" y="214" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">малая амплитуда, провал зуба</text>`,
  hall: `<text x="300" y="120" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">полка выше 0, пропуск</text>`,
  lambda: `<text x="430" y="70" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">залипла богатая</text>`,
  rail: `<text x="460" y="200" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">быстрый спад</text>`,
  drop: `<text x="300" y="190" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">плохая масса</text>`,
  knock: `<text x="300" y="150" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">слабый отклик</text>`,
  crankv: `<text x="300" y="200" fill="${BAD}" font-size="13" font-family="ui-sans-serif,system-ui">просадка ниже нормы</text>`,
};

export function scopeHtml(kind: string, caption?: string): string {
  const label = (caption ?? CAPTION[kind] ?? "Эталон и отклонение").slice(0, 48);
  const safe = label.replace(/[&<>"]/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    return "&" + "quot;";
  });
  const grid = Array.from({ length: 12 }, (_, i) => `<line x1="${28 + i * 58}" y1="22" x2="${28 + i * 58}" y2="246" stroke="#1a4068"/>`).join("") +
    Array.from({ length: 6 }, (_, i) => `<line x1="24" y1="${28 + i * 36}" x2="696" y2="${28 + i * 36}" stroke="#1a4068"/>`).join("");
  return `<figure class="scope"><svg viewBox="0 0 720 292" role="img" aria-label="${safe}">
    <rect width="720" height="292" rx="16" fill="#0c2342"/>
    <g stroke-width="1">${grid}</g>
    <text x="36" y="46" fill="#9fb4c9" font-size="12" font-family="ui-sans-serif,system-ui">CH A</text>
    <text x="600" y="46" fill="#ffb088" font-size="12" font-family="ui-monospace,monospace">DC · экран</text>
    ${traces(kind)}
    ${MARK[kind] ?? ""}
    <circle cx="48" cy="270" r="5" fill="${GOOD}"/><text x="60" y="274" fill="#d5e4ef" font-size="12" font-family="ui-sans-serif,system-ui">эталон</text>
    <circle cx="150" cy="270" r="5" fill="${BAD}"/><text x="162" y="274" fill="#d5e4ef" font-size="12" font-family="ui-sans-serif,system-ui">отклонение</text>
    <text x="280" y="274" fill="#8eabc4" font-size="12" font-family="ui-sans-serif,system-ui">${safe}</text>
  </svg></figure>`;
}

export function waveForTitle(title: string): string {
  const t = title.toLowerCase();
  const rules: [RegExp, string][] = [
    [/can-bus|flexray|ethernet|most/, "can"],
    [/lin-bus/, "lin"],
    [/kurbel/, "inductive"],
    [/nocken|phasen/, "sync"],
    [/lambda|sauerstoff|nox|partikelsensor/, "lambda"],
    [/drossel|fahrpedal|pedalwert/, "dual"],
    [/luftmasse|hfm/, "maf"],
    [/kühlmitteltemp|ansauglufttemp|abgastemp|außentemp|kraftstofftemp|verdampfer|innenraumtemp|öltemp|ntc/, "ntc"],
    [/klopf/, "knock"],
    [/raddrehzahl|drehzahl/, "absind"],
    [/einspritz|injektor|adblue/, "inj"],
    [/zündspule|zündkerze/, "coil"],
    [/generator/, "alt"],
    [/anlasser|starterbatterie|batterie/, "crankv"],
    [/kraftstoffpumpe/, "pump"],
    [/agr|magnetventil|zumesseinheit|druckregel|ladedruck|tankentlüft|leerlauf|drall|absperr/, "pwm"],
    [/raildruck|saugrohr|map|differenzdruck|drucksensor|öldruck|kältemitteldruck|bremsdruck/, "map"],
    [/relais|sicherung|leitungs/, "drop"],
    [/strom/, "clamp"],
  ];
  for (const [re, wave] of rules) if (re.test(t)) return wave;
  return "scale";
}
