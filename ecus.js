/* JC Diagnose · Alle Steuergeräte (CAN 11 Bit, UDS ISO 14229 / ISO 15765-3)
   Sucht Steuergeräte (Anfrage-IDs 0x700–0x7E7 (ohne 0x7DF)), liest/löscht Fehlerspeicher (19 02 / 14), liest Kennungen (22 F1xx)
   und beliebige Datenkennungen (22 xxxx). Herstellerspezifische Datenkennungen sind nicht genormt:
   sie werden als Rohwerte gezeigt, nicht umgerechnet. Nur genormte Namen: 7E0 Motor, 7E1 Getriebe. */
(function(){
'use strict';
function hx(n, w){ var s = n.toString(16).toUpperCase(); while (s.length < (w||2)) s = '0'+s; return s; }
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

// ---- Antworten lesen -------------------------------------------------------------------------
function pairs(line){ var s = String(line).replace(/[^0-9A-Fa-f]/g, ''); var o = [], i; for (i = 0; i+1 < s.length; i += 2) o.push(parseInt(s.substr(i, 2), 16)); return o; }
// Nutzdaten ohne Kopf (ATH0): Einzelbild "59 02 FF ..." oder Mehrbild "00B / 0: ... / 1: ..."
function payload(raw){
  var t = String(raw||'').replace(/\r/g, ''), L = t.split('\n').map(function(x){ return x.trim(); }).filter(Boolean), out = [], total = -1, multi = false;
  L.forEach(function(l){ if (/^[0-9A-F]:/i.test(l)) multi = true; });
  if (multi){
    L.forEach(function(l){ if (/^[0-9A-F]:/i.test(l)) out = out.concat(pairs(l.replace(/^[0-9A-F]:/i, ''))); else if (/^[0-9A-F]{3}$/i.test(l)) total = parseInt(l, 16); });
    if (total > 0 && out.length > total) out = out.slice(0, total);
    return out;
  }
  for (var i = 0; i < L.length; i++){
    if (/NO DATA|UNABLE|ERROR|STOPPED|SEARCHING|BUS|^\?|TIMEOUT|FEHLER/i.test(L[i])) continue;
    if (/^[0-9A-F\s]+$/i.test(L[i])) return pairs(L[i]);
  }
  return null;
}
// Mit Kopf (ATH1): Zeilen "7E8027E00" → [{id, data}]
function frames(raw){
  var o = []; String(raw||'').replace(/\r/g, '').split('\n').forEach(function(l){
    var s = l.replace(/\s+/g, ''); if (!/^[0-9A-F]{5,}$/i.test(s)) return;
    var id = s.slice(0, 3).toUpperCase(); if (id.charAt(0) !== '7') return;
    o.push({id:id, data:pairs(s.slice(3))});
  });
  return o;
}
var NRC = {0x10:['allgemein abgelehnt','отказ (общий)'],0x11:['Dienst nicht unterstützt','сервис не поддерживается'],0x12:['Unterfunktion nicht unterstützt','подфункция не поддерживается'],0x13:['falsche Länge','неверная длина'],0x22:['Bedingungen nicht erfüllt (Zündung an? Fahrzeug steht?)','условия не выполнены (зажигание? машина стоит?)'],0x31:['Wert/Kennung nicht vorhanden','идентификатор отсутствует'],0x33:['Sicherheitszugriff nötig','нужен защищённый доступ'],0x35:['falscher Schlüssel','неверный ключ'],0x78:['Antwort verzögert','ответ задерживается'],0x7E:['in dieser Sitzung nicht unterstützt','не поддерживается в этой сессии'],0x7F:['in dieser Sitzung nicht unterstützt','не поддерживается в этой сессии']};
function nrcText(c){ var a = NRC[c], ru = window.JCLANG === 'ru'; return a ? (ru ? a[1] : a[0]) : '0x'+hx(c); }
// → {ok:true,data:[...ohne Dienstbyte]} | {neg:true,nrc} | {none:true}
function check(b, svc){
  if (!b || !b.length) return {none:true};
  if (b[0] === 0x7F && b[1] === svc) return {neg:true, nrc:b[2], text:nrcText(b[2])};
  if (b[0] === svc + 0x40) return {ok:true, data:b.slice(1)};
  return {none:true};
}

// ---- Fehlercodes -----------------------------------------------------------------------------
function dtc3(b0, b1, b2){ var L = 'PCBU'.charAt(b0 >> 6); return L + ((b0 >> 4) & 3) + (b0 & 15).toString(16).toUpperCase() + hx(b1) + (b2 != null ? '-'+hx(b2) : ''); }
function dtcFlags(st){ var f = []; if (st & 1) f.push('aktiv'); if (st & 4) f.push('anstehend'); if (st & 8) f.push('bestätigt'); if (st & 128) f.push('Lampe'); return f; }
function flagText(st){ var ru = window.JCLANG === 'ru', m = {aktiv:'активна', anstehend:'ожидающая', 'bestätigt':'подтверждена', Lampe:'лампа'}; return dtcFlags(st).map(function(x){ return ru ? m[x] : x; }).join(', ') || (ru ? 'сохранена' : 'gespeichert'); }

// ---- Bus-Zugriff -----------------------------------------------------------------------------
async function setup(io, ecu){
  await io.send('ATSH'+ecu.req, 2000); if (ecu.res) await io.send('ATCRA'+ecu.res, 2000); await io.send('ATH0', 2000);
}
async function restore(io){
  try { await io.send('ATSH7DF', 2000); await io.send('ATAR', 2000); await io.send('ATH0', 2000); await io.send('ATST96', 2000); } catch(e){}
}
async function request(io, ecu, hexReq, svc, to){
  await setup(io, ecu);
  var raw = await io.send(hexReq, to || 4000);
  return check(payload(raw), svc);
}
async function withBus(io, fn){ try { return await fn(); } finally { await restore(io); } }

// Suche: Test-Anfrage 3E 00 an jede ID; wer antwortet, ist ein Steuergerät
async function scan(io, opt, onProg){
  opt = opt || {}; var found = [], ids = [], i, id;
  var dp = ''; try { dp = String(await io.send('ATDP', 2000)); } catch(e){}
  if (dp && !/CAN/i.test(dp) && !opt.force) throw new Error((window.JCLANG==='ru' ? 'Сканирование блоков работает только по CAN. Протокол адаптера: ' : 'Steuergeräte-Suche funktioniert nur über CAN. Protokoll des Adapters: ')+dp.replace(/\s+/g,' ').trim());
  var from = opt.from != null ? opt.from : 0x700, to = opt.to != null ? opt.to : 0x7E7;
  for (id = from; id <= to; id++) if (id !== 0x7DF) ids.push(id);
  await withBus(io, async function(){
    await io.send('ATH1', 2000); await io.send('ATAR', 2000); await io.send('ATST19', 2000);
    for (i = 0; i < ids.length; i++){
      if (io.closed) throw new Error('Verbindung getrennt'); if (opt.cancel && opt.cancel()) break;
      var req = hx(ids[i], 3); if (onProg) onProg(i+1, ids.length, found.length, req);
      var raw = ''; try { await io.send('ATSH'+req, 1500); raw = await io.send('3E00', 700); } catch(e){ if (io.closed) throw e; continue; }
      var fr = frames(raw).filter(function(f){ return f.id !== req; });
      for (var k = 0; k < fr.length; k++){ var d = fr[k].data; // [PCI, 7E, 00] bzw. [PCI, 7F, 3E, nrc]
        if (d.length >= 3 && (d[1] === 0x7E || d[1] === 0x7F)){ if (!found.some(function(x){ return x.req === req; })) found.push({req:req, res:fr[k].id}); break; } }
    }
  });
  return found;
}

// ---- Fehlerspeicher ------------------------------------------------------------------------
async function readDtcs(io, ecu){
  return withBus(io, async function(){
    var r = await request(io, ecu, '1902FF', 0x19, 5000), list = [], i, d, kwp = false;
    if (r.ok){ d = r.data; // 02, Verfügbarkeitsmaske, dann je 4 Byte: DTC(3) + Status
      for (i = 2; i + 4 <= d.length; i += 4) list.push({code:dtc3(d[i], d[i+1], d[i+2]), st:d[i+3], raw:hx(d[i])+hx(d[i+1])+hx(d[i+2])});
    } else {
      var k = await request(io, ecu, '1800FF00', 0x18, 5000);
      if (k.ok){ kwp = true; d = k.data; // Anzahl, dann je 3 Byte DTC (2 Byte + Status)
        for (i = 1; i + 3 <= d.length; i += 3) list.push({code:dtc3(d[i], d[i+1]), st:d[i+2], raw:hx(d[i])+hx(d[i+1])});
      } else if (r.neg){ return {neg:true, text:r.text, nrc:r.nrc}; }
      else return {none:true};
    }
    return {list:list.filter(function(x){ return x.raw !== '000000' && x.raw !== '0000'; }), kwp:kwp};
  });
}
async function clearDtcs(io, ecu){
  return withBus(io, async function(){
    var r = await request(io, ecu, '14FFFFFF', 0x14, 6000);
    if (r.ok) return {ok:true};
    return r.neg ? {neg:true, text:r.text, nrc:r.nrc} : {none:true};
  });
}

// ---- Kennungen und Rohwerte ----------------------------------------------------------------
var IDENT = [[0xF190,'VIN','VIN'],[0xF187,'Teilenummer','Номер детали'],[0xF189,'Software-Version','Версия ПО'],[0xF197,'Systemname','Название системы'],[0xF18C,'Seriennummer','Серийный номер'],[0xF191,'Hardware-Nr.','Номер железа']];
function ascii(d){ return d.map(function(c){ return c >= 32 && c < 127 ? String.fromCharCode(c) : ''; }).join('').trim(); }
function isText(d){ return d.length > 2 && d.every(function(c){ return c >= 32 && c < 127; }); }
function uintOf(d){ if (!d.length || d.length > 4) return null; var v = 0; d.forEach(function(c){ v = v*256 + c; }); return v; }
async function readDid(io, ecu, did){
  var r = await request(io, ecu, '22'+hx(did, 4), 0x22, 4000);
  if (r.ok){ var d = r.data.slice(2); return {did:did, data:d, hex:d.map(function(c){ return hx(c); }).join(' '), text:isText(d) ? ascii(d) : '', num:uintOf(d)}; }
  return r.neg ? {did:did, neg:true, text:r.text, nrc:r.nrc} : {did:did, none:true};
}
async function ident(io, ecu){
  return withBus(io, async function(){
    var out = {}, i;
    for (i = 0; i < IDENT.length; i++){ var r = await readDid(io, ecu, IDENT[i][0]); if (r.data && r.data.length) out[IDENT[i][0].toString(16).toUpperCase()] = r.text || r.hex; }
    return out;
  });
}
async function readDids(io, ecu, dids){
  return withBus(io, async function(){ var out = []; for (var i = 0; i < dids.length; i++){ if (io.closed) break; out.push(await readDid(io, ecu, dids[i])); } return out; });
}
async function scanDids(io, ecu, from, to, onProg, cancel){
  return withBus(io, async function(){
    var out = [], d;
    for (d = from; d <= to; d++){ if (io.closed || (cancel && cancel())) break; if (onProg) onProg(d - from + 1, to - from + 1, out.length);
      var r = await readDid(io, ecu, d); if (r.data) out.push(r); }
    return out;
  });
}

// ---- Demo-Steuergeräte (nur für Tests, Namen frei erfunden) ----------------------------------------
var DEMO = {
  '7E0': {res:'7E8', dtc:[[0x03,0x01,0x00,0x2F],[0x01,0x71,0x00,0x24]], did:{F190:'WVWZZZ1KZAW000001', F187:'06A906032', F189:'0001', F197:'DEMO MOTOR'}, live:{2001:function(t){ return [Math.round(800+200*Math.sin(t/1500))>>8, Math.round(800+200*Math.sin(t/1500))&255]; }}},
  '7E1': {res:'7E9', dtc:[[0x07,0x31,0x00,0x08]], did:{F187:'09G927749', F197:'DEMO GETRIEBE'}, live:{}},
  '7B0': {res:'7B8', dtc:[[0x40,0x35,0x00,0x2F],[0x40,0x40,0x00,0x08]], did:{F187:'1K0907379', F189:'0204', F197:'DEMO ABS'}, live:{2040:function(t){ var v = Math.round(5000+1500*Math.sin(t/900)); return [v>>8, v&255]; }, 2041:function(t){ var v = Math.round(5000+1400*Math.sin(t/900+0.3)); return [v>>8, v&255]; }}},
  '7C0': {res:'7C8', dtc:[], did:{F187:'5K0920xxx', F197:'DEMO KOMBIINSTRUMENT'}, live:{}},
  '7D0': {res:'7D8', dtc:[[0x80,0x01,0x12,0x28]], did:{F187:'5Q0959655', F197:'DEMO AIRBAG'}, live:{}}
};
var ds = {hdr:false, req:null, on:false};
function dframe(id, bytes){ // Antwort im ELM-Format (ATS0): Kopf oder Nutzdaten, Mehrbild über 7 Byte
  var h = function(a){ return a.map(function(c){ return hx(c); }).join(''); };
  if (ds.hdr) return id + hx(bytes.length) + h(bytes);
  if (bytes.length <= 7) return h(bytes);
  var s = hx(bytes.length, 3), i, n = 0; for (i = 0; i < bytes.length; i += 7) s += '\n'+(n++ % 16).toString(16).toUpperCase()+':'+h(bytes.slice(i, i+7)); return s;
}
function demo(c){
  if (c === 'ATDP') return 'ISO 15765-4 (CAN 11/500)';
  if (c === 'ATH1'){ ds.hdr = true; return 'OK'; } if (c === 'ATH0'){ ds.hdr = false; return null; }
  if (c.indexOf('ATSH') === 0){ var a = c.slice(4); if (a === '7DF'){ ds.on = false; ds.req = null; return null; } ds.on = true; ds.req = a; return 'OK'; }
  if (!ds.on) return null;
  if (c.indexOf('AT') === 0) return 'OK';
  var e = DEMO[ds.req]; if (!e) return 'NO DATA';
  var b = pairs(c), t = Date.now(), k;
  if (c === '3E00') return dframe(e.res, [0x7E, 0x00]);
  if (c === '1902FF'){ var o = [0x59, 0x02, 0xFF]; e.dtc.forEach(function(x){ o = o.concat(x); }); return dframe(e.res, o); }
  if (c === '14FFFFFF'){ if (ds.req === '7C0') return dframe(e.res, [0x7F, 0x14, 0x22]); e.dtc = []; return dframe(e.res, [0x54]); }
  if (b[0] === 0x22 && b.length === 3){ k = hx(b[1])+hx(b[2]); var v = e.did[k];
    if (v) return dframe(e.res, [0x62, b[1], b[2]].concat(v.split('').map(function(ch){ return ch.charCodeAt(0); })));
    if (e.live[k]) return dframe(e.res, [0x62, b[1], b[2]].concat(e.live[k](t)));
    return dframe(e.res, [0x7F, 0x22, 0x31]); }
  return dframe(e.res, [0x7F, b[0] || 0, 0x11]);
}

window.JCECU = {scan:scan, readDtcs:readDtcs, clearDtcs:clearDtcs, ident:ident, readDid:readDid, readDids:readDids, scanDids:scanDids, restore:restore, demo:demo, IDENT:IDENT, flagText:flagText, dtc3:dtc3, payload:payload, frames:frames, hx:hx, sleep:sleep,
  label:function(req){ return req === '7E0' ? ['Motor','Двигатель'] : req === '7E1' ? ['Getriebe','КПП'] : null; },
  kinds:[['ABS / ESP','ABS / ESP'],['Airbag','Airbag'],['Kombiinstrument','Приборная панель'],['Komfort / Zentralelektrik','Комфорт / ЦЭ'],['Klima','Климат'],['Lenkung','Рулевое'],['Getriebe','КПП'],['Motor','Двигатель'],['Gateway','Шлюз'],['Sonstiges','Прочее']]};
})();
