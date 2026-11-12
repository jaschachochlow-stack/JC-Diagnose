/* JC Diagnose – alle OBD-Protokolle prüfen, bestes wählen; aktive Tests (Stellglieder, Routinen) */
(function(){
'use strict';
function hx(n, w){ var s = n.toString(16).toUpperCase(); while (s.length < (w||2)) s = '0'+s; return s; }
function ru(){ return window.JCLANG === 'ru'; }

// ELM327-Protokollnummern; 'slow' = langsame Initialisierung (5-Baud / Fast-Init)
var LIST = [
  {n:'6', can:true,  bus:'CAN 11 Bit / 500 kbit',  ru:'CAN 11 бит / 500 кбит',  note:'ISO 15765-4, ab 2008 Pflicht'},
  {n:'7', can:true,  bus:'CAN 29 Bit / 500 kbit',  ru:'CAN 29 бит / 500 кбит',  note:'ISO 15765-4'},
  {n:'8', can:true,  bus:'CAN 11 Bit / 250 kbit',  ru:'CAN 11 бит / 250 кбит',  note:'ISO 15765-4'},
  {n:'9', can:true,  bus:'CAN 29 Bit / 250 kbit',  ru:'CAN 29 бит / 250 кбит',  note:'ISO 15765-4'},
  {n:'5', can:false, slow:true, bus:'KWP2000 Fast-Init (ISO 14230-4)', ru:'KWP2000 быстрая инициализация (ISO 14230-4)', note:'K-Line'},
  {n:'4', can:false, slow:true, bus:'KWP2000 5-Baud (ISO 14230-4)',    ru:'KWP2000 5 бод (ISO 14230-4)',    note:'K-Line'},
  {n:'3', can:false, slow:true, bus:'ISO 9141-2 (5-Baud)',             ru:'ISO 9141-2 (5 бод)',             note:'K-Line, ältere Fahrzeuge'},
  {n:'1', can:false, bus:'SAE J1850 PWM (41,6 kbit)', ru:'SAE J1850 PWM (41,6 кбит)', note:'Ford (alt)'},
  {n:'2', can:false, bus:'SAE J1850 VPW (10,4 kbit)', ru:'SAE J1850 VPW (10,4 кбит)', note:'GM (alt)'},
  {n:'B', can:true,  bus:'Benutzer 1 (CAN 11 Bit / 125 kbit)', ru:'Пользовательский 1 (CAN 11 бит / 125 кбит)', note:'oft Komfort-CAN'},
  {n:'C', can:true,  bus:'Benutzer 2 (CAN 11 Bit / 50 kbit)',  ru:'Пользовательский 2 (CAN 11 бит / 50 кбит)',  note:'selten'},
  {n:'A', can:true,  bus:'SAE J1939 (29 Bit / 250 kbit)', ru:'SAE J1939 (29 бит / 250 кбит)', note:'Nutzfahrzeuge, antwortet nicht auf 0100'}
];
var BY = {}; LIST.forEach(function(p){ BY[p.n] = p; });
function label(n){ var p = BY[n]; return p ? (ru() ? p.ru : p.bus) : 'ATSP'+n; }

function maskPids(base, hex){ var v = parseInt(hex, 16), o = [], i; for (i = 0; i < 32; i++) if (v & (0x80000000 >>> i)) o.push(base + i + 1); return o; }
// alle Antworten 41 xx <4 Byte> in einem Text (jede Zeile = ein Steuergerät)
function answers(txt, pid){
  var out = [], pre = '41'+hx(pid);
  String(txt||'').replace(/\r/g, '').split('\n').forEach(function(l){
    var s = l.replace(/[^0-9A-Fa-f]/g, '').toUpperCase(), i = s.indexOf(pre);
    if (i >= 0 && s.length >= i + 10) out.push(s.substr(i + 4, 8));
  });
  return out;
}

async function probeOne(io, n, tmo){
  var t0 = Date.now(), r = {n:n, ok:false, ecus:0, pids:[], ms:0, raw:''};
  try {
    await io.send('ATSP'+n, 3000);
    var txt = await io.send('0100', tmo), a = answers(txt, 0);
    r.raw = String(txt||'').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!a.length){ r.ms = Date.now() - t0; return r; }
    r.ok = true; r.ecus = a.length;
    var set = {}; a.forEach(function(m){ maskPids(0, m).forEach(function(p){ set[p] = 1; }); });
    // weitere Bereiche (0120, 0140 …), solange das letzte Bit gesetzt ist
    var base = 0x20, cont = Object.keys(set).indexOf(String(0x20)) >= 0;
    while (cont && base <= 0xC0){
      var t = await io.send('01'+hx(base), 3000), aa = answers(t, base); cont = false;
      aa.forEach(function(m){ maskPids(base, m).forEach(function(p){ set[p] = 1; }); });
      if (set[base + 0x20]){ cont = true; base += 0x20; }
    }
    r.pids = Object.keys(set).map(Number).sort(function(x, y){ return x - y; });
  } catch(e){ r.err = (e && e.message) || String(e); if (io.closed) throw e; }
  r.ms = Date.now() - t0;
  return r;
}
function score(r){ if (!r.ok) return 0; var p = BY[r.n] || {}; return r.pids.length + r.ecus * 8 + (p.can ? 10 : 0) + ({'6':4,'7':2,'8':1}[r.n] || 0); }

var probing = false;
// Prüft alle Protokolle nacheinander; Rückgabe {list, best, orig}. cancel(): Abbruch; onProg(i, n, nr, ergebnisse)
async function probeAll(io, opt, onProg){
  opt = opt || {}; var order = opt.only && opt.only.length ? opt.only : LIST.map(function(p){ return p.n; }), list = [], orig = '', i;
  try { orig = String(await io.send('ATDPN', 2000)).replace(/[^0-9A-Fa-f]/g, ''); } catch(e){}
  probing = true;
  try {
    await io.send('ATH0', 2000); await io.send('ATCAF1', 2000);
    for (i = 0; i < order.length; i++){
      if (opt.cancel && opt.cancel()) break;
      var n = order[i]; if (onProg) onProg(i+1, order.length, n, list);
      var r = await probeOne(io, n, BY[n] && BY[n].slow ? 14000 : 9000); r.score = score(r); list.push(r);
    }
  } finally { probing = false; }
  var best = null; list.forEach(function(r){ if (r.ok && (!best || r.score > best.score)) best = r; });
  return {list:list, best:best ? best.n : null, orig:orig};
}
// Protokoll fest einstellen und prüfen; Rückgabe wie initAdapter (name, number, can, probe, warning)
async function useProto(io, n){
  await io.send('ATSP'+n, 3000);
  var probe = await io.send('0100', 12000);
  var name = String(await io.send('ATDP', 2000)).replace(/\s+/g, ' ').trim(), num = String(await io.send('ATDPN', 2000)).trim();
  var p = BY[n] || {};
  return {name:name || label(n), number:num, can:!!p.can, probe:probe, warning:answers(probe, 0).length ? '' : (ru() ? 'Блок не отвечает на 0100.' : 'Steuergerät antwortet nicht auf 0100.')};
}

function demo(c){
  if (!probing) return null;
  if (/^ATSP/.test(c)){ demo.sp = c.slice(4) || '0'; return 'OK'; }
  if (c === 'ATH0' || c === 'ATCAF1') return 'OK';
  var sp = demo.sp;
  if (c === '0100'){ if (sp === '6') return '4100BE3FA813\n4100983B8011'; if (sp === '3') return 'BUS INIT: ...ERROR'; if (sp === '5') return '4100BE1FA813'; return 'UNABLE TO CONNECT'; }
  if (c === '0120'){ return sp === '6' ? '4120A007E011\n4120800000' + '01' : '4120A0000000'; }
  if (c === '0140'){ return sp === '6' ? '4140FED00000\n4140440000' + '00' : 'NO DATA'; }
  if (/^01/.test(c)) return 'NO DATA';
  return null;
}

// ---- Aktive Tests ---------------------------------------------------------------------------------------
// erlaubte Dienste: Sitzung (10 01/03), Tester Present, Routinen (31), Ein-/Ausgangssteuerung (2F), Lesen (22/19), OBD-Test (08)
function checkLine(line){
  var s = String(line||'').replace(/[\s,;]/g, '').toUpperCase();
  if (!s) return {skip:true};
  if (!/^[0-9A-F]+$/.test(s) || s.length % 2 || s.length > 16) return {err:ru() ? 'Не HEX или слишком длинно: ' : 'Kein gültiges Hex oder zu lang: '};
  var svc = s.substr(0, 2), sub = s.substr(2, 2), rid = s.substr(4, 4);
  var allowed = ['10', '22', '2F', '31', '3E', '19', '08'];
  if (allowed.indexOf(svc) < 0) return {err:(ru() ? 'Служба запрещена (безопасность): ' : 'Dienst gesperrt (Sicherheit): ') + svc};
  if (svc === '10' && sub !== '01' && sub !== '03') return {err:ru() ? 'Только сессии 10 01 и 10 03' : 'Nur Sitzungen 10 01 und 10 03 erlaubt'};
  if (svc === '31' && /^FF0[0-9A-F]$/.test(rid)) return {err:ru() ? 'Стирание/программирование (FF 0x) заблокировано' : 'Löschen/Programmieren (RID FF0x) gesperrt'};
  if (svc === '31' && rid.length < 4) return {err:ru() ? 'Нужен RID (31 01 xxxx)' : 'RID fehlt (31 01 xxxx)'};
  if (svc === '2F' && s.length < 8) return {err:ru() ? 'Нужны DID и режим (2F xxxx 03)' : 'DID und Steuerart fehlen (2F xxxx 03)'};
  return {hex:s};
}
function parseSteps(text){
  var steps = [], errs = [];
  String(text||'').split(/\n/).forEach(function(l){ var c = checkLine(l); if (c.skip) return; if (c.err) errs.push(c.err + l.trim()); else steps.push(c.hex); });
  return {steps:steps, errs:errs};
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
// Folge ausführen. Rückgabe [{cmd, res:{ok|neg|none, hex, text}}]
async function runSteps(io, ecu, steps, log){
  var out = [], i, r;
  for (i = 0; i < steps.length; i++){
    if (io.closed) throw new Error(ru() ? 'Соединение разорвано' : 'Verbindung getrennt');
    r = await JCECU.rawReq(io, ecu, steps[i], 4000); out.push({cmd:steps[i], res:r}); if (log) log(steps[i], r);
    if (r.neg || r.none) break;
  }
  return out;
}
// Start-Folge, Wartezeit (mit Tester-Present), Stopp-Folge; Stopp läuft immer, auch bei Abbruch/Fehler
async function runTest(io, ecu, test, hooks){
  hooks = hooks || {}; var res = {start:[], stop:[], started:false}, t0;
  await JCECU.begin(io);
  try {
    res.start = await runSteps(io, ecu, test.start, hooks.log);
    var last = res.start[res.start.length - 1];
    res.started = !!(last && last.res.ok) && res.start.length === test.start.length;
    if (res.started && test.secs > 0){
      t0 = Date.now();
      while (Date.now() - t0 < test.secs * 1000){
        if (hooks.cancel && hooks.cancel()) break;
        if (hooks.tick) hooks.tick(Math.ceil((test.secs * 1000 - (Date.now() - t0)) / 1000));
        await sleep(Math.min(1000, test.secs * 1000));
        try { await JCECU.rawReq(io, ecu, '3E00', 2000); } catch(e){ if (io.closed) throw e; }
      }
    }
  } finally {
    try { if (test.stop && test.stop.length) res.stop = await runSteps(io, ecu, test.stop, hooks.log); } catch(e){}
    await JCECU.end(io);
  }
  return res;
}

var TEMPLATES = [
  {id:'ses',  de:'Erweiterte Sitzung öffnen', ru:'Открыть расширенную сессию', start:'1003', stop:'1001', secs:3},
  {id:'rtn',  de:'Routine starten (31 01 RID)', ru:'Запустить рутину (31 01 RID)', start:'1003\n3101XXXX', stop:'3102XXXX\n1001', secs:5},
  {id:'io',   de:'Stellglied ansteuern (2F DID 03)', ru:'Включить исполнительный элемент (2F DID 03)', start:'1003\n2FXXXX03', stop:'2FXXXX00\n1001', secs:5},
  {id:'obd8', de:'OBD-Test Modus 08 (z. B. 0801)', ru:'Тест OBD режим 08 (напр. 0801)', start:'0801', stop:'', secs:0}
];

window.JCPRO = {LIST:LIST, BY:BY, label:label, probeAll:probeAll, probeOne:probeOne, useProto:useProto, score:score, demo:demo, answers:answers,
  checkLine:checkLine, parseSteps:parseSteps, runTest:runTest, TEMPLATES:TEMPLATES};
})();
