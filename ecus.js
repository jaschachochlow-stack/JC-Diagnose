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
    var id = s.slice(0, 3).toUpperCase();
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


// ---- Bekannte Steuergeräte-Adressen je Konzern ------------------------------------------------
// Quelle VAG: Sammlung der UDS-CAN-IDs aus ODIS (github.com/ConnorHowell/vag-uds-ids); PSA: github.com/ludwig-v/arduino-psa-diag (ECU_LIST).
// Format: [Anfrage-ID, Antwort-ID, Name DE, Name RU]. Gilt nur, wenn die Marke passt; sonst würden gleiche IDs falsch benannt.
var VAG = [
['7E0','7E8','Motorsteuerung 1','ЭБУ двигателя 1'],['7E2','7EA','Motorsteuerung 2','ЭБУ двигателя 2'],['7E1','7E9','Getriebesteuerung','ЭБУ КПП'],
['7E6','7EE','Antriebsmotor (Hybrid/Elektro)','Тяговый мотор (гибрид/электро)'],['7E5','7ED','Batterie-Energiemanagement','Управление энергией батареи'],['765','7CF','Batterie-Laden','Зарядка батареи'],['728','792','Batterieregelung','Регулятор батареи'],
['713','77D','Bremsenelektronik (ABS/ESP)','Тормозная электроника (ABS/ESP)'],['715','77F','Airbag','Airbag (подушки безопасности)'],['714','77E','Kombiinstrument','Приборная панель'],['771','7DB','Tacho','Спидометр'],
['710','77A','Gateway','Шлюз (Gateway)'],['70E','778','Zentralelektrik','Центральная электрика'],['70D','777','Komfortsystem','Система комфорта'],['745','7AF','Komfortsystem 2','Система комфорта 2'],
['712','77C','Lenkhilfe (Servolenkung)','Усилитель руля'],['716','780','Aktive Lenkung / Anzeige','Активное рулевое / дисплей'],['70C','776','Lenksäulenelektronik','Электроника рулевой колонки'],['731','79B','Lenksäulenverriegelung','Блокировка рулевой колонки'],
['711','77B','Wegfahrsperre','Иммобилайзер'],['732','79C','Zugang/Start (Kessy)','Бесключевой доступ/старт (Kessy)'],['746','7B0','Klimaanlage','Климат-контроль'],['71A','784','Klimabedienteil hinten','Климат задний'],['719','783','Klimakompressor','Компрессор кондиционера'],
['76A','7D4','Standheizung','Автономный отопитель'],['750','7BA','Fahrzeugpositionserkennung','Определение положения авто'],['751','7BB','Lenkwinkelsensor','Датчик угла поворота руля'],['752','7BC','Elektrische Parkbremse','Электрический стояночный тормоз'],
['753','7BD','Schaltmodul Getriebe','Модуль выбора передач'],['754','7BE','Leuchtweitenregulierung','Корректор фар'],['755','7BF','Fahrwerksregelung','Управление подвеской'],['772','7DC','Elektronische Dämpferregelung','Электронное управление амортизаторами'],
['757','7C1','Abstandsregelung (ACC)','Адаптивный круиз (ACC)'],['756','7C0','Abstandsregelung 2','Адаптивный круиз 2'],['70A','774','Einparkhilfe','Парктроник'],['70B','775','Reifendruckkontrolle','Контроль давления в шинах'],
['70F','779','Allradsteuerung','Полный привод'],['71D','787','Allradsteuerung 2','Полный привод 2'],['71E','788','Schließelektronik','Электроника замков'],['720','78A','Radbremse hinten rechts','Тормоз заднего правого колеса'],['71F','789','Radbremse hinten links','Тормоз заднего левого колеса'],
['730','79A','Fernlichtassistent','Ассистент дальнего света'],['748','7B2','Fernlichtassistent 2','Ассистент дальнего света 2'],['758','7C2','Bildverarbeitung','Обработка изображения'],['74F','7B9','Frontsensor Fahrerassistenz','Фронтальный датчик ассистентов'],
['74E','7B8','Spurwechselassistent','Ассистент смены полосы'],['75E','7C8','Gurtstraffer vorne links','Преднатяжитель переднего левого ремня'],['75F','7C9','Gurtstraffer vorne rechts','Преднатяжитель переднего правого ремня'],
['74A','7B4','Tür Fahrerseite','Дверь водителя'],['74B','7B5','Tür Beifahrerseite','Дверь пассажира'],['73E','7A8','Tür hinten Fahrerseite','Дверь задняя водителя'],['73F','7A9','Tür hinten Beifahrerseite','Дверь задняя пассажира'],
['74C','7B6','Sitzverstellung Fahrer','Регулировка сиденья водителя'],['74D','7B7','Sitzverstellung Beifahrer','Регулировка сиденья пассажира'],['72D','797','Dachelektronik','Электроника крыши'],['73D','7A7','Dachelektronik 2','Электроника крыши 2'],
['733','79D','Schiebetür links','Сдвижная дверь левая'],['734','79E','Schiebetür rechts','Сдвижная дверь правая'],['718','782','Radio','Радио'],['76C','7D6','Navigation','Навигация'],['76F','7D9','Soundsystem','Аудиосистема'],
['76D','7D7','TV-Tuner','ТВ-тюнер'],['770','7DA','Mediaplayer 1','Медиаплеер 1'],['76E','7D8','Mediaplayer 3','Медиаплеер 3'],['773','7DD','Infotainment-Steuergerät','Блок инфотейнмента'],['749','7B3','Infotainment-Schnittstelle','Интерфейс инфотейнмента'],
['767','7D1','Telematik','Телематика'],['76B','7D5','Telefon / externe Kommunikation','Телефон / внешняя связь'],['769','7D3','Rückfahrkamera','Камера заднего вида'],['726','790','Bordkamera','Бортовая камера'],['727','791','Nachtsicht','Ночное видение'],
['71B','785','Head-up-Display','Проекционный дисплей'],['747','7B1','Anhängerfunktion','Функция прицепа'],['723','78D','Heckklappe','Крышка багажника'],['721','78B','Sensorelektronik','Электроника датчиков'],['762','7CC','Bremssystem-Sensorik','Датчики тормозной системы'],
['763','7CD','Mikrocontroller-Einheit','Микроконтроллерный блок'],['73C','7A6','Hilfsanzeige','Вспомогательный дисплей'],['71C','786','Sound-Aktuator','Звуковой актуатор']
];
var PSA = [
['744','644','Airbag','Airbag (подушки безопасности)'],['75C','65C','Alarmanlage','Сигнализация'],['760','660','Autoradio','Магнитола'],['752','652','Bordnetz / Karosserie (BSI)','Бортовая сеть / кузов (BSI)'],
['76D','66D','Klimaanlage','Климат-контроль'],['75F','65F','Kombiinstrument','Приборная панель'],['6A8','688','Motorsteuerung (Einspritzung)','ЭБУ двигателя (впрыск)'],['6AD','68D','ABS/ESP','ABS/ESP'],
['6AF','68F','Doppelkupplungsgetriebe','Робот с двойным сцеплением'],['6A9','689','Getriebesteuerung','ЭБУ КПП'],['6B5','695','Lenkung','Рулевое управление'],['6B8','698','Reifendruckkontrolle','Контроль давления в шинах'],
['765','665','Anzeige / Display','Дисплей'],['764','664','Telematik','Телематика'],['7E0','7E8','Motorsteuerung','ЭБУ двигателя']
];
var BR = {
  vag:{n:['VAG (VW, Audi, Seat, Škoda, Cupra, Porsche)','VAG (VW, Audi, Seat, Škoda, Cupra, Porsche)'], t:VAG, re:/volkswagen|\bvw\b|audi|seat|cupra|skoda|škoda|porsche|bentley|lamborghini/i},
  psa:{n:['Peugeot / Citroën / DS','Peugeot / Citroën / DS'], t:PSA, re:/peugeot|citro|^ds\b/i},
  other:{n:['Andere Marke (nur Standard-Namen)','Другая марка (только стандартные названия)'], t:[[ '7E0','7E8','Motorsteuerung','ЭБУ двигателя'],['7E1','7E9','Getriebesteuerung','ЭБУ КПП']], re:null}
};
function brandOf(marke){ var k; if (!marke) return 'other'; for (k in BR) if (BR[k].re && BR[k].re.test(marke)) return k; return 'other'; }
function tableOf(brand){ return (BR[brand] || BR.other).t; }
function known(brand, req){ var t = tableOf(brand), i; for (i = 0; i < t.length; i++) if (t[i][0] === req) return t[i]; return null; }

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

// Suche: Test-Anfrage 3E 00 an jede ID; wer antwortet, ist ein Steuergerät.
// IDs: alle bekannten der Marke + Durchlauf 0x700–0x7E7 (+ 0x500–0x6FF bei „tief"), ohne 0x7DF (Sammeladresse)
async function scan(io, opt, onProg){
  opt = opt || {}; var found = [], ids = [], seen = {}, i, id, br = opt.brand || 'other';
  var dp = ''; try { dp = String(await io.send('ATDP', 2000)); } catch(e){}
  if (dp && !/CAN/i.test(dp) && !opt.force) throw new Error((window.JCLANG==='ru' ? 'Сканирование блоков работает только по CAN. Протокол адаптера: ' : 'Steuergeräte-Suche funktioniert nur über CAN. Protokoll des Adapters: ')+dp.replace(/\s+/g,' ').trim());
  function add(x){ var r = hx(x, 3); if (x === 0x7DF || seen[r]) return; seen[r] = 1; ids.push(r); }
  tableOf(br).forEach(function(k){ add(parseInt(k[0], 16)); });
  for (id = 0x7E0; id <= 0x7E7; id++) add(id);
  for (id = 0x700; id <= 0x7E7; id++) add(id);
  if (opt.deep) for (id = 0x500; id <= 0x6FF; id++) add(id);
  await withBus(io, async function(){
    await io.send('ATH1', 2000); await io.send('ATAR', 2000); await io.send('ATST20', 2000);
    for (i = 0; i < ids.length; i++){
      if (io.closed) throw new Error('Verbindung getrennt'); if (opt.cancel && opt.cancel()) break;
      var req = ids[i], kn = known(br, req); if (onProg) onProg(i+1, ids.length, found.length, req);
      var raw = ''; try { await io.send('ATSH'+req, 1500); if (kn) await io.send('ATCRA'+kn[1], 1500); raw = await io.send('3E00', 700); if (kn) await io.send('ATAR', 1500); } catch(e){ if (io.closed) throw e; continue; }
      var fr = frames(raw).filter(function(f){ return f.id !== req; });
      for (var k = 0; k < fr.length; k++){ var d = fr[k].data; // [PCI, 7E, 00] bzw. [PCI, 7F, 3E, nrc]
        if (d.length >= 3 && (d[1] === 0x7E || d[1] === 0x7F)){ found.push({req:req, res:fr[k].id}); break; } }
    }
  });
  found.sort(function(a, b){ return parseInt(a.req, 16) - parseInt(b.req, 16); });
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
  '713': {res:'77D', dtc:[[0x40,0x35,0x00,0x2F],[0x40,0x40,0x00,0x08]], did:{F187:'1K0907379', F189:'0204', F197:'DEMO ABS'}, live:{2040:function(t){ var v = Math.round(5000+1500*Math.sin(t/900)); return [v>>8, v&255]; }, 2041:function(t){ var v = Math.round(5000+1400*Math.sin(t/900+0.3)); return [v>>8, v&255]; }}},
  '714': {res:'77E', dtc:[], did:{F187:'5K0920xxx', F197:'DEMO KOMBIINSTRUMENT'}, live:{}},
  '715': {res:'77F', dtc:[[0x80,0x01,0x12,0x28]], did:{F187:'5Q0959655', F197:'DEMO AIRBAG'}, live:{}},
  '755': {res:'7BF', dtc:[[0x56,0x20,0x00,0x08]], did:{F187:'5Q0907553', F197:'DEMO FAHRWERK'}, live:{}}
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
  label:function(req, brand){ var k = known(brand || 'other', req); return k ? [k[2], k[3]] : null; }, brands:BR, brandOf:brandOf,
  kinds:[['ABS / ESP','ABS / ESP'],['Airbag','Airbag'],['Kombiinstrument','Приборная панель'],['Komfort / Zentralelektrik','Комфорт / ЦЭ'],['Klima','Климат'],['Lenkung','Рулевое'],['Getriebe','КПП'],['Motor','Двигатель'],['Gateway','Шлюз'],['Sonstiges','Прочее']]};
})();
