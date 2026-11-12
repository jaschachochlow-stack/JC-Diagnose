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
// Ford: Modul-Adressen aus FORScan/Ford-Werkstatthandbuch (7E0 PCM, 760 ABS, 720 IPC, 726 BCM/SJB); Hyundai/Kia: Kona-PID-Tabelle (7A0 BCM, 7D1 ABS/ESP).
var FORD = [['7E0','7E8','Motorsteuerung (PCM)','ЭБУ двигателя (PCM)'],['7E1','7E9','Getriebesteuerung (TCM)','ЭБУ КПП (TCM)'],['760','768','ABS-Modul','Модуль ABS'],['720','728','Kombiinstrument (IPC)','Приборная панель (IPC)'],['726','72E','Karosseriemodul (BCM/SJB)','Блок кузова (BCM/SJB)']];
var HK = [['7E0','7E8','Motorsteuerung (ECM)','ЭБУ двигателя (ECM)'],['7E1','7E9','Getriebesteuerung (TCU)','ЭБУ КПП (TCU)'],['7A0','7A8','Karosseriemodul (BCM)','Блок кузова (BCM)'],['7D1','7D9','ABS/ESP','ABS/ESP']];
// Erkennung aus der Kennung des Steuergeräts (OBD-Name 09 0A, Systemname F197): gilt für alle Marken
var GUESS = [
[/airbag|srs|restraint|occupant|\borc\b|\bocs\b|\bacu\b/i,'Airbag','Airbag (подушки безопасности)'],
[/abs|esp|\besc\b|brake|bremse|skid|\bvsc\b|\bdsc\b|\bhcu\b/i,'Bremsen (ABS/ESP)','Тормоза (ABS/ESP)'],
[/transm|\btcm\b|\btcu\b|getriebe|gearbox|\bdsg\b|\btcc\b|gear ?shift/i,'Getriebesteuerung','ЭБУ КПП'],
[/engine|\becm\b|\bpcm\b|\bdme\b|\bede\b|\bmed\b|motor(?!ized)|\bdde\b/i,'Motorsteuerung','ЭБУ двигателя'],
[/cluster|kombi|instrument|meter|\bipc\b|\bdash/i,'Kombiinstrument','Приборная панель'],
[/gateway|\bgw\b|\bcgw\b|\bzgw\b|\bzgm\b/i,'Gateway','Шлюз (Gateway)'],
[/steer|lenk|\beps\b|\bpas\b/i,'Lenkung','Рулевое управление'],
[/climat|hvac|klima|air ?con|\bclim\b|\bac\b|heater/i,'Klimaanlage','Климат-контроль'],
[/park|\bpdc\b|\bpts\b|sonar|rear ?view|camera|kamera/i,'Einparkhilfe / Kamera','Парктроник / камера'],
[/radar|\bacc\b|cruise|adas|lane|spur|abstand/i,'Fahrerassistenz','Системы помощи водителю'],
[/radio|infot|head ?unit|navi|\bmmi\b|media|audio|sound|tuner|multimedia/i,'Infotainment / Radio','Мультимедиа / радио'],
[/tpms|tire|reifen|\brdk\b/i,'Reifendruckkontrolle','Контроль давления в шинах'],
[/hybrid|\bhv\b|battery|batter|\bbms\b|\bbecm\b|inverter|charger|\bobc\b|dcdc|e-?drive|traction|\bvcu\b/i,'Hybrid / Batterie / Antrieb','Гибрид / батарея / привод'],
[/immo|kessy|keyless|smart ?key|access|\bkey\b|schl[uü]ssel/i,'Zugang / Wegfahrsperre','Доступ / иммобилайзер'],
[/door|t[uü]r|\bdoor\b/i,'Tür','Дверь'],
[/seat|sitz/i,'Sitz','Сиденье'],
[/light|lamp|leucht|headl|licht|\bahl\b|\bafs\b/i,'Beleuchtung','Освещение'],
[/wiper|wisch|rain/i,'Wischer / Regensensor','Дворники / датчик дождя'],
[/suspens|damp|fahrwerk|\bdcc\b|\bcdc\b|air ?susp|\bpasm\b/i,'Fahrwerk / Dämpfer','Подвеска / амортизаторы'],
[/awd|4wd|allrad|transfer|haldex|xdrive|quattro/i,'Allradantrieb','Полный привод'],
[/park ?brake|\bepb\b|feststell/i,'Elektr. Parkbremse','Электр. стояночный тормоз'],
[/body|\bbcm\b|\bsjb\b|\bbsi\b|\bbdc\b|comfort|komfort|bordnetz|zentral|central|\bgem\b|\bfem\b|\bcas\b/i,'Karosserie / Komfort','Кузов / комфорт'],
[/telem|\btcu\b|phone|telefon|connect|\bbluetooth/i,'Telematik / Telefon','Телематика / телефон']
];
function guess(idn){ if (!idn) return null; var t = [idn['090A'], idn.F197, idn.F18A].filter(Boolean).join(' '); if (!t) return null; for (var i = 0; i < GUESS.length; i++) if (GUESS[i][0].test(t)) return [GUESS[i][1], GUESS[i][2]]; return null; }
var BR = {
  vag:{n:['VAG (VW, Audi, Seat, Škoda, Cupra, Porsche)','VAG (VW, Audi, Seat, Škoda, Cupra, Porsche)'], t:VAG, re:/volkswagen|\bvw\b|audi|seat|cupra|skoda|škoda|porsche|bentley|lamborghini/i},
  ford:{n:['Ford / Lincoln','Ford / Lincoln'], t:FORD, re:/ford|lincoln|mercury/i},
  hk:{n:['Hyundai / Kia / Genesis','Hyundai / Kia / Genesis'], t:HK, re:/hyundai|\bkia\b|genesis/i},
  bmw:{n:['BMW / Mini','BMW / Mini'], t:[['7E0','7E8','Motorsteuerung','ЭБУ двигателя'],['7E1','7E9','Getriebesteuerung','ЭБУ КПП']], re:/bmw|\bmini\b|rolls/i},
  fca:{n:['Fiat / Chrysler / Jeep / Dodge / Ram','Fiat / Chrysler / Jeep / Dodge / Ram'], t:[['7E0','7E8','Motorsteuerung','ЭБУ двигателя'],['7E1','7E9','Getriebesteuerung','ЭБУ КПП']], re:/fiat|chrysler|jeep|dodge|\bram\b|alfa|maserati|lancia/i},
  psa:{n:['Peugeot / Citroën / DS','Peugeot / Citroën / DS'], t:PSA, re:/peugeot|citro|^ds\b/i},
  other:{n:['Andere Marke (nur Standard-Namen)','Другая марка (только стандартные названия)'], t:[[ '7E0','7E8','Motorsteuerung','ЭБУ двигателя'],['7E1','7E9','Getriebesteuerung','ЭБУ КПП']], re:null}
};
function brandOf(marke){ var k; if (!marke) return 'other'; for (k in BR) if (BR[k].re && BR[k].re.test(marke)) return k; return 'other'; }
function tableOf(brand){ return (BR[brand] || BR.other).t; }
function known(brand, req){ var t = tableOf(brand), i; for (i = 0; i < t.length; i++) if (t[i][0] === req) return t[i]; return null; }

// ---- Adressierungsarten ------------------------------------------------------------------------
// 11 = CAN 11 Bit (ISO 15765-4, 500 kbit) · 29 = CAN 29 Bit, Anfrage 18DA<ZG>F1 (500 kbit) · bmw = erweiterte Adressierung, Tester 6F1, Ziel im 1. Datenbyte
// 11s / 29s = wie 11 / 29 mit 250 kbit
var MODES = {
  '11':{sp:'6', n:['CAN 11 Bit / 500 kbit','CAN 11 бит / 500 кбит']},
  '29':{sp:'7', n:['CAN 29 Bit / 500 kbit (18DAxxF1)','CAN 29 бит / 500 кбит (18DAxxF1)']},
  'bmw':{sp:'6', n:['BMW-Adressierung (6F1, erweitert)','Адресация BMW (6F1, расширенная)']},
  '11s':{sp:'8', n:['CAN 11 Bit / 250 kbit','CAN 11 бит / 250 кбит']},
  '29s':{sp:'9', n:['CAN 29 Bit / 250 kbit','CAN 29 бит / 250 кбит']}
};
// Namen für 29 Bit (FCA 2013–2017: ECM 10, TCM 18, ABS 28, BCM 40; Quelle evmetrics.co.uk/obd/ecus.html) und BMW (ZGW 10, DME 12, CAS 40, DSC 60; Quelle bimmer.studio/ecu-explorer, quantexlab.com/en/develop/elm327.html)
var FCA29 = [['10','','Motorsteuerung (ECM)','ЭБУ двигателя (ECM)'],['18','','Getriebesteuerung (TCM)','ЭБУ КПП (TCM)'],['28','','ABS','ABS'],['40','','Karosseriemodul (BCM)','Блок кузова (BCM)']];
var BMWT = [['10','','Zentrales Gateway (ZGW)','Центральный шлюз (ZGW)'],['12','','Motorelektronik (DME/DDE)','Электроника двигателя (DME/DDE)'],['40','','Zugangssystem / Bordnetz (CAS/BDC)','Система доступа / бортсеть (CAS/BDC)'],['60','','Fahrdynamik (DSC)','Динамическая стабилизация (DSC)']];
function knownM(brand, req, mode){
  var t = (mode === 'bmw') ? (brand === 'bmw' ? BMWT : []) : (mode === '29' || mode === '29s') ? (brand === 'fca' ? FCA29 : []) : tableOf(brand), i;
  for (i = 0; i < t.length; i++) if (t[i][0] === req) return t[i];
  return null;
}

// ---- Bus-Zugriff -----------------------------------------------------------------------------
// begin/end klammern eine ganze Folge von Zugriffen: Protokoll und Adressierung werden nur einmal gewechselt und am Ende zurückgestellt.
async function begin(io){
  io.__depth = (io.__depth || 0) + 1;
  if (io.__depth === 1){ io.__orig = ''; try { io.__orig = String(await io.send('ATDPN', 2000)).replace(/[^0-9A-Fa-f]/g, ''); } catch(e){} io.__sp = io.__orig.replace(/^A/i, ''); io.__ext = false; }
}
async function end(io){
  io.__depth = Math.max(0, (io.__depth || 1) - 1); if (io.__depth) return;
  try {
    await io.send('ATCEA', 2000); await io.send('ATFCSM0', 2000); await io.send('ATAR', 2000); await io.send('ATH0', 2000); await io.send('ATST96', 2000);
    var o = io.__orig || ''; if (o && io.__sp !== o.replace(/^A/i, '')){ await io.send('ATSP'+o, 3000); io.__sp = o.replace(/^A/i, ''); }
    var d = o.replace(/^A/i, '').charAt(0); if (d === '7' || d === '9') await io.send('ATSHDB33F1', 2000); else if (d === '6' || d === '8') await io.send('ATSH7DF', 2000);
  } catch(e){}
  io.__ext = false;
}
async function restore(io){ if (io.__depth) return; io.__depth = 1; await end(io); }
async function useMode(io, mode){ var sp = (MODES[mode] || MODES['11']).sp; if (io.__sp !== sp){ await io.send('ATSP'+sp, 3000); io.__sp = sp; } }
async function setup(io, ecu){
  var m = ecu.mode || '11';
  await useMode(io, m);
  if (m === 'bmw'){
    await io.send('ATSH6F1', 2000); await io.send('ATFCSH6F1', 2000); await io.send('ATFCSD'+ecu.req+'30FF32', 2000); await io.send('ATFCSM1', 2000);
    await io.send('ATCRA6'+ecu.req, 2000); await io.send('ATCEA'+ecu.req, 2000); io.__ext = true;
  } else {
    if (io.__ext){ await io.send('ATCEA', 2000); await io.send('ATFCSM0', 2000); io.__ext = false; }
    if (m === '29' || m === '29s'){ await io.send('ATSHDA'+ecu.req+'F1', 2000); await io.send('ATCRA18DAF1'+ecu.req, 2000); }
    else { await io.send('ATSH'+ecu.req, 2000); if (ecu.res) await io.send('ATCRA'+ecu.res, 2000); else await io.send('ATAR', 2000); }
  }
  await io.send('ATH0', 2000);
}
async function request(io, ecu, hexReq, svc, to){
  await setup(io, ecu);
  var raw = await io.send(hexReq, to || 4000), b = payload(raw);
  if (b && ecu.mode === 'bmw' && b[0] === 0xF1) b = b.slice(1);
  return check(b, svc);
}
async function rawReq(io, ecu, hexReq, to){ // beliebige Anfrage an ein Steuergerät (ohne Auswertung des Dienstes)
  await setup(io, ecu);
  var raw = await io.send(hexReq, to || 4000), b = payload(raw);
  if (b && ecu.mode === 'bmw' && b[0] === 0xF1) b = b.slice(1);
  if (!b || !b.length) return {none:true, raw:String(raw||'').replace(/\s+/g, ' ').trim()};
  var hex = b.map(function(c){ return hx(c); }).join(' ');
  if (b[0] === 0x7F) return {neg:true, nrc:b[2], svc:b[1], text:nrcText(b[2]), bytes:b, hex:hex};
  return {ok:true, bytes:b, hex:hex};
}
async function withBus(io, fn){ await begin(io); try { return await fn(); } finally { await end(io); } }

// Suche: Test-Anfrage 3E 00 an jede Adresse; wer antwortet, ist ein Steuergerät.
function frames29(raw){
  var o = []; String(raw||'').replace(/\r/g, '').split('\n').forEach(function(l){ var s = l.replace(/\s+/g, '').toUpperCase(); var m = /^(18DAF1[0-9A-F]{2})([0-9A-F]{4,})$/.exec(s); if (m) o.push({id:m[1], data:pairs(m[2])}); });
  return o;
}
async function scanMode(io, mode, opt, onProg, found){
  var br = opt.brand || 'other', ids = [], seen = {}, id, i, n0 = found.length, ml = (MODES[mode].n)[window.JCLANG === 'ru' ? 1 : 0];
  function add(x){ var r = hx(x, 3); if (x === 0x7DF || seen[r]) return; seen[r] = 1; ids.push(r); }
  if (mode === '11' || mode === '11s'){
    if (mode === '11') tableOf(br).forEach(function(k){ add(parseInt(k[0], 16)); });
    for (id = 0x7E0; id <= 0x7E7; id++) add(id);
    for (id = 0x700; id <= 0x7E7; id++) add(id);
    if (opt.depth >= 1) for (id = 0x500; id <= 0x6FF; id++) add(id);
    if (opt.depth >= 2) for (id = 0x000; id <= 0x4FF; id++) add(id);
  } else { for (id = 0; id <= 0xFF; id++) if (id !== 0xF1) ids.push(hx(id, 2)); }
  await begin(io);
  try {
    await useMode(io, mode); await io.send('ATH1', 2000); await io.send('ATAR', 2000); await io.send('ATST20', 2000);
    if (io.__ext){ await io.send('ATCEA', 2000); await io.send('ATFCSM0', 2000); io.__ext = false; }
    for (i = 0; i < ids.length; i++){
      if (io.closed) throw new Error('Verbindung getrennt'); if (opt.cancel && opt.cancel()) break;
      var req = ids[i], raw = '', hit = null; if (onProg) onProg(i+1, ids.length, found.length - n0, req, ml);
      try {
        if (mode === 'bmw'){ await io.send('ATCRA6'+req, 1500); await io.send('ATSH6F1', 1500); await io.send('ATCEA'+req, 1500); io.__ext = true; raw = await io.send('3E00', 700); }
        else if (mode === '29' || mode === '29s'){ await io.send('ATSHDA'+req+'F1', 1500); raw = await io.send('3E00', 700); }
        else { var kn = knownM(br, req, mode); await io.send('ATSH'+req, 1500); if (kn && kn[1]) await io.send('ATCRA'+kn[1], 1500); raw = await io.send('3E00', 700); if (kn && kn[1]) await io.send('ATAR', 1500); }
      } catch(e){ if (io.closed) throw e; continue; }
      if (mode === 'bmw'){ frames(raw).forEach(function(f){ var d = f.data; if (!hit && f.id === '6'+req && d.length >= 4 && d[0] === 0xF1 && (d[2] === 0x7E || d[2] === 0x7F)) hit = {req:req, res:f.id, mode:mode}; }); }
      else if (mode === '29' || mode === '29s'){ frames29(raw).forEach(function(f){ var d = f.data; if (!hit && f.id === '18DAF1'+req && d.length >= 3 && (d[1] === 0x7E || d[1] === 0x7F)) hit = {req:req, res:f.id, mode:mode}; }); }
      else { frames(raw).filter(function(f){ return f.id !== req; }).forEach(function(f){ var d = f.data; if (!hit && d.length >= 3 && (d[1] === 0x7E || d[1] === 0x7F)) hit = {req:req, res:f.id, mode:mode}; }); }
      if (hit) found.push(hit);
    }
  } finally { await end(io); }
}
// opt: brand, depth (0–2), modes (z. B. ['11','29']), fallback (Modi, falls weniger als 3 Steuergeräte gefunden), cancel
async function scan(io, opt, onProg){
  opt = opt || {}; var found = [], modes = (opt.modes && opt.modes.length) ? opt.modes : ['11'], i;
  await begin(io);
  try {
    for (i = 0; i < modes.length; i++){ if (opt.cancel && opt.cancel()) break; await scanMode(io, modes[i], opt, onProg, found); }
    if (opt.fallback && found.length < 3 && !(opt.cancel && opt.cancel())){
      var more = opt.fallback.filter(function(m){ return modes.indexOf(m) < 0; });
      for (i = 0; i < more.length; i++){ if (opt.cancel && opt.cancel()) break; if (found.length >= 3 && more[i].indexOf('s') > 0) break; await scanMode(io, more[i], opt, onProg, found); }
    }
  } finally { await end(io); }
  found.sort(function(a, b){ return (a.mode === b.mode ? 0 : (a.mode < b.mode ? -1 : 1)) || (parseInt(a.req, 16) - parseInt(b.req, 16)); });
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
var IDENT = [[0xF190,'VIN','VIN'],[0xF18A,'Hersteller (Zulieferer)','Поставщик'],[0xF194,'Software-Nr.','Номер ПО'],[0xF193,'Hardware-Version','Версия железа'],[0xF187,'Teilenummer','Номер детали'],[0xF189,'Software-Version','Версия ПО'],[0xF197,'Systemname','Название системы'],[0xF18C,'Seriennummer','Серийный номер'],[0xF191,'Hardware-Nr.','Номер железа']];
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
    if (/^7E[0-7]$/.test(ecu.req)){ // genormter OBD-Name des Steuergeräts (Modus 09, PID 0A)
      try { var o = await request(io, ecu, '090A', 0x09, 4000); if (o.ok && o.data.length > 2){ var nm = ascii(o.data.slice(2).filter(function(c){ return c; })); if (nm) out['090A'] = nm; } } catch(e){ if (io.closed) throw e; } }
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
var DEMO29 = {
  '10': {res:'18DAF110', dtc:[[0x01,0x71,0x00,0x24]], did:{F187:'68123456AA', F197:'DEMO ECM 29BIT'}, live:{}},
  '28': {res:'18DAF128', dtc:[[0x40,0x35,0x00,0x2F]], did:{F187:'68234567AB', F197:'DEMO ABS 29BIT'}, live:{}},
  '40': {res:'18DAF140', dtc:[], did:{F187:'68345678AC', F197:'DEMO BCM 29BIT'}, live:{}}
};
var DEMOBMW = {
  '12': {res:'612', dtc:[[0x03,0x01,0x00,0x2F]], did:{F187:'8604321', F197:'DEMO DME'}, live:{}},
  '60': {res:'660', dtc:[[0x40,0x35,0x00,0x2F]], did:{F187:'6851234', F197:'DEMO DSC'}, live:{}},
  '10': {res:'610', dtc:[], did:{F187:'9283456', F197:'DEMO ZGW'}, live:{}}
};
var ds = {hdr:false, req:null, on:false, sp:'6', cea:null};
function dframe(id, bytes){ // Antwort im ELM-Format (ATS0): Kopf oder Nutzdaten, Mehrbild über 7 Byte
  var h = function(a){ return a.map(function(c){ return hx(c); }).join(''); };
  var bmw = ds.req === '6F1';
  if (ds.hdr) return id + (bmw ? 'F1' : '') + hx(bytes.length) + h(bytes);
  if (bmw) bytes = [0xF1].concat(bytes);
  if (bytes.length <= 7) return h(bytes);
  var s = hx(bytes.length, 3), i, n = 0; for (i = 0; i < bytes.length; i += 7) s += '\n'+(n++ % 16).toString(16).toUpperCase()+':'+h(bytes.slice(i, i+7)); return s;
}
function demoEcu(){
  if (ds.req === '6F1') return ds.cea ? DEMOBMW[ds.cea] : null;
  var m = /^DA([0-9A-F]{2})F1$/.exec(ds.req || ''); if (m) return DEMO29[m[1]];
  return ['0', '6', '8'].indexOf(ds.sp) >= 0 ? DEMO[ds.req] : null;
}
function demo(c){
  if (c === 'ATDP') return 'ISO 15765-4 (CAN 11/500)';
  if (c === 'ATDPN') return 'A6';
  if (c.indexOf('ATSP') === 0){ ds.sp = c.slice(4).replace(/^A/, '') || '0'; return 'OK'; }
  if (c.indexOf('ATCEA') === 0){ ds.cea = c.slice(5) || null; return 'OK'; }
  if (c === 'ATH1'){ ds.hdr = true; return 'OK'; } if (c === 'ATH0'){ ds.hdr = false; return null; }
  if (c.indexOf('ATSH') === 0){ var a = c.slice(4); if (a === '7DF' || a === 'DB33F1'){ ds.on = false; ds.req = null; return null; } ds.on = true; ds.req = a; return 'OK'; }
  if (!ds.on) return null;
  if (c.indexOf('AT') === 0) return 'OK';
  var e = demoEcu(); if (!e) return 'NO DATA';
  var b = pairs(c), t = Date.now(), k;
  if (c === '3E00') return dframe(e.res, [0x7E, 0x00]);
  if (c === '090A' && ds.req === '7E0') return dframe(e.res, [0x49, 0x0A, 0x01].concat('ECM-EngineControl'.split('').map(function(ch){ return ch.charCodeAt(0); }), [0, 0, 0]));
  if (c === '1902FF'){ var o = [0x59, 0x02, 0xFF]; e.dtc.forEach(function(x){ o = o.concat(x); }); return dframe(e.res, o); }
  if (c === '14FFFFFF'){ if (ds.req === '7C0') return dframe(e.res, [0x7F, 0x14, 0x22]); e.dtc = []; return dframe(e.res, [0x54]); }
  if (b[0] === 0x10){ if (ds.req === '7C0') return dframe(e.res, [0x7F, 0x10, 0x22]); return dframe(e.res, [0x50, b[1], 0x00, 0x32, 0x01, 0xF4]); }
  if (b[0] === 0x31 && b.length >= 4){ if (b[2] === 0xFF) return dframe(e.res, [0x7F, 0x31, 0x31]); return dframe(e.res, [0x71, b[1], b[2], b[3]]); }
  if (b[0] === 0x2F && b.length >= 4) return dframe(e.res, [0x6F, b[1], b[2], b[3]]);
  if (b[0] === 0x22 && b.length === 3){ k = hx(b[1])+hx(b[2]); var v = e.did[k];
    if (v) return dframe(e.res, [0x62, b[1], b[2]].concat(v.split('').map(function(ch){ return ch.charCodeAt(0); })));
    if (e.live[k]) return dframe(e.res, [0x62, b[1], b[2]].concat(e.live[k](t)));
    return dframe(e.res, [0x7F, 0x22, 0x31]); }
  return dframe(e.res, [0x7F, b[0] || 0, 0x11]);
}

window.JCECU = {rawReq:rawReq, scan:scan, readDtcs:readDtcs, clearDtcs:clearDtcs, ident:ident, readDid:readDid, readDids:readDids, scanDids:scanDids, restore:restore, demo:demo, IDENT:IDENT, flagText:flagText, dtc3:dtc3, payload:payload, frames:frames, hx:hx, sleep:sleep,
  label:function(req, brand, mode){ var k = knownM(brand || 'other', req, mode || '11'); return k ? [k[2], k[3]] : null; }, MODES:MODES, begin:begin, end:end, guess:guess, brands:BR, brandOf:brandOf,
  kinds:[['ABS / ESP','ABS / ESP'],['Airbag','Airbag'],['Kombiinstrument','Приборная панель'],['Komfort / Zentralelektrik','Комфорт / ЦЭ'],['Klima','Климат'],['Lenkung','Рулевое'],['Getriebe','КПП'],['Motor','Двигатель'],['Gateway','Шлюз'],['Sonstiges','Прочее']]};
})();
