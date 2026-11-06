/* JC Diagnose · OBD-II Live-Daten, Modus 01 (SAE J1979 / ISO 15031-5)
   Eigene Tabelle: PID, Name DE/RU, Gruppe, Umrechnung, Plausibilitätshinweis.
   Herstellerspezifische Werte (Modus 22) sind nicht genormt und daher nicht enthalten. */
(function(){
'use strict';
function s8(x){ return x > 127 ? x - 256 : x; }
function s16(a, b){ var v = a*256 + b; return v > 32767 ? v - 65536 : v; }
function pct(a){ return a*100/255; }
function trim(a){ return (a-128)*100/128; }
function f(v, d){ return (Math.round(v*Math.pow(10, d||0))/Math.pow(10, d||0)); }
function fx(v, d){ return Number(v).toLocaleString(window.JCLANG==='ru'?'ru-RU':'de-DE', {minimumFractionDigits:d||0, maximumFractionDigits:d||0, useGrouping:false}); }

// Gruppen
var G = {
  motor:['Motor','Двигатель'], gemisch:['Gemisch / Lambda','Смесь / лямбда'], luft:['Luft / Druck','Воздух / давление'],
  temp:['Temperaturen','Температуры'], kraft:['Kraftstoff','Топливо'], diesel:['Diesel / Turbo / AGR','Дизель / турбо / EGR'],
  abgas:['Abgas / Katalysator','Выхлоп / катализатор'], elek:['Elektrik / Status','Электрика / статус'], fahrt:['Fahrt / Zähler','Движение / счётчики']
};
var FUEL_SYS = {1:['offener Regelkreis (kalt)','разомкнутый контур (холодный)'],2:['geschlossener Regelkreis','замкнутый контур (лямбда)'],4:['offen (Last/Schub)','разомкнут (нагрузка/торможение)'],8:['offen (Systemfehler)','разомкнут (ошибка системы)'],16:['geschlossen, Sondenfehler','замкнут, ошибка датчика']};
var FUEL_TYPE = ['–','Benzin/Бензин','Methanol','Ethanol','Diesel/Дизель','LPG/Газ','CNG/Метан','Propan','Elektro','Bifuel Benzin','Bifuel Methanol','Bifuel Ethanol','Bifuel LPG','Bifuel CNG','Bifuel Propan','Bifuel Elektro','Bifuel Elektro/Verbrenner','Hybrid Benzin','Hybrid Ethanol','Hybrid Diesel','Hybrid Elektro','Hybrid gemischt','Hybrid regenerativ','Bifuel Diesel'];
var OBD_STD = {1:'OBD-II (CARB)',2:'OBD (EPA)',3:'OBD + OBD-II',4:'OBD-I',5:'keine OBD-Pflicht',6:'EOBD (EU)',7:'EOBD + OBD-II',8:'EOBD + OBD',9:'EOBD, OBD, OBD-II',10:'JOBD (JP)',11:'JOBD + OBD-II',12:'JOBD + EOBD',13:'JOBD, EOBD, OBD-II',17:'EMD',18:'EMD+',19:'HD OBD-C',20:'HD OBD',21:'WWH OBD',23:'HD EOBD-I',24:'HD EOBD-I N',25:'HD EOBD-II',26:'HD EOBD-II N',28:'OBDBr-1',29:'OBDBr-2',30:'KOBD',31:'IOBD I',32:'IOBD II',33:'HD EOBD-IV'};

// v(...) liefert {v:Zahl|null, t:Text, w:Warnung, n:[Hinweis DE, RU]}
function num(v, unit, d, warn, note){ return {v:v, t:(v==null?'–':fx(v,d)+(unit?' '+unit:'')), w:!!warn, n:note||null}; }
function txt(t, warn, note){ return {v:null, t:t, w:!!warn, n:note||null}; }

var L = [];  // [pid, de, ru, gruppe, minBytes, decode, kapitel]
function P(pid, de, ru, g, n, dec, ch){ L.push({pid:pid, de:de, ru:ru, g:g, n:n, dec:dec, ch:ch||null}); }

P(0x01,'Status seit Löschen (MIL, Fehleranzahl)','Статус после сброса (MIL, число ошибок)','elek',4,function(d){ var mil = d[0]&128, n = d[0]&127; return txt((mil?'MIL EIN':'MIL aus')+' · '+n+' DTC'+((d[1]&8)?' · Diesel':' · Benzin'), !!mil); });
P(0x03,'Kraftstoffsystem-Status','Статус топливной системы','gemisch',1,function(d){ var a = FUEL_SYS[d[0]]; return txt(a ? (window.JCLANG==='ru'?a[1]:a[0]) : '0x'+d[0].toString(16), d[0]===8||d[0]===16); },'k7');
P(0x04,'Berechnete Motorlast','Расчётная нагрузка','motor',1,function(d){ return num(pct(d[0]),'%',0); },'k3');
P(0x05,'Kühlmitteltemperatur','Температура ОЖ','temp',1,function(d){ var t = d[0]-40; return num(t,'°C',0,t>115||t<-30,t>115?['Überhitzung prüfen','Проверь перегрев']:null); },'k4');
P(0x06,'Kurzzeit-Trim Bank 1','Краткосрочная коррекция, банк 1','gemisch',1,function(d){ var v = trim(d[0]); return num(v,'%',1,Math.abs(v)>15); },'k7');
P(0x07,'Langzeit-Trim Bank 1','Долгосрочная коррекция, банк 1','gemisch',1,function(d){ var v = trim(d[0]); return num(v,'%',1,Math.abs(v)>10,Math.abs(v)>10?['Gemisch dauerhaft korrigiert: Falschluft, Luftmasse, Kraftstoffdruck','Смесь постоянно корректируется: подсос, ДМРВ, давление топлива']:null); },'k7');
P(0x08,'Kurzzeit-Trim Bank 2','Краткосрочная коррекция, банк 2','gemisch',1,function(d){ var v = trim(d[0]); return num(v,'%',1,Math.abs(v)>15); },'k7');
P(0x09,'Langzeit-Trim Bank 2','Долгосрочная коррекция, банк 2','gemisch',1,function(d){ var v = trim(d[0]); return num(v,'%',1,Math.abs(v)>10); },'k7');
P(0x0A,'Kraftstoffdruck (Überdruck)','Давление топлива (избыточное)','kraft',1,function(d){ return num(d[0]*3,'kPa',0); });
P(0x0B,'Saugrohrdruck absolut','Абсолютное давление во впуске','luft',1,function(d){ return num(d[0],'kPa',0); },'k10');
P(0x0C,'Drehzahl','Обороты','motor',2,function(d){ return num((d[0]*256+d[1])/4,'1/min',0); },'k5');
P(0x0D,'Geschwindigkeit','Скорость','fahrt',1,function(d){ return num(d[0],'km/h',0); },'k55');
P(0x0E,'Zündzeitpunkt','Угол опережения зажигания','motor',1,function(d){ return num(d[0]/2-64,'° v. OT',1); });
P(0x0F,'Ansauglufttemperatur','Температура впускного воздуха','temp',1,function(d){ var t = d[0]-40; return num(t,'°C',0,t>80); },'k12');
P(0x10,'Luftmasse (MAF)','Массовый расход воздуха (ДМРВ)','luft',2,function(d){ return num((d[0]*256+d[1])/100,'g/s',2); });
P(0x11,'Drosselklappe absolut','Положение дросселя','motor',1,function(d){ return num(pct(d[0]),'%',1); },'k9');
P(0x12,'Sekundärluft (Soll-Status)','Вторичный воздух (статус)','abgas',1,function(d){ return txt({1:'vor Kat',2:'nach Kat',4:'aus / Außenluft',8:'Diagnose'}[d[0]]||('0x'+d[0].toString(16))); });
P(0x13,'Lambdasonden vorhanden (2 Bänke)','Наличие лямбда-зондов (2 банка)','gemisch',1,function(d){ var o = []; for (var i=0;i<8;i++) if (d[0]&(1<<i)) o.push('B'+(i<4?1:2)+'S'+(i%4+1)); return txt(o.join(' ')||'–'); });
for (var s=0;s<8;s++) (function(s){
  P(0x14+s,'Lambdasonde B'+(s<4?1:2)+'S'+(s%4+1)+' (Spannung, Trim)','Лямбда-зонд B'+(s<4?1:2)+'S'+(s%4+1)+' (напряжение, коррекция)','gemisch',2,function(d){ var v = d[0]/200, tr = d[1]===255 ? '' : ' · '+fx(trim(d[1]),1)+' %'; return {v:v, t:fx(v,3)+' V'+tr, w:false, n:(s%4===0)?['Vor Kat: schwankt 0,1–0,9 V (Sprungsonde)','До катализатора: колеблется 0,1–0,9 В']:['Nach Kat: ruhig um 0,6–0,8 V','После катализатора: ровно около 0,6–0,8 В']}; },'k7');
})(s);
P(0x1C,'OBD-Norm des Fahrzeugs','Стандарт OBD автомобиля','elek',1,function(d){ return txt(OBD_STD[d[0]]||('Typ '+d[0])); });
P(0x1D,'Lambdasonden vorhanden (4 Bänke)','Наличие лямбда-зондов (4 банка)','gemisch',1,function(d){ var o = []; for (var i=0;i<8;i++) if (d[0]&(1<<i)) o.push('B'+(Math.floor(i/2)+1)+'S'+(i%2+1)); return txt(o.join(' ')||'–'); });
P(0x1E,'Nebenabtrieb (PTO)','Отбор мощности (PTO)','elek',1,function(d){ return txt(d[0]&1?'aktiv':'inaktiv'); });
P(0x1F,'Laufzeit seit Motorstart','Время с запуска двигателя','fahrt',2,function(d){ var v = d[0]*256+d[1]; return txt(Math.floor(v/60)+' min '+(v%60)+' s'); });
P(0x21,'Strecke mit MIL an','Пробег с горящей MIL','fahrt',2,function(d){ var v = d[0]*256+d[1]; return num(v,'km',0,v>0); });
P(0x22,'Raildruck (relativ zu Saugrohr)','Давление в рампе (отн. впуска)','kraft',2,function(d){ return num((d[0]*256+d[1])*0.079,'kPa',1); });
P(0x23,'Raildruck (Diesel/Direkteinspritzer)','Давление в рампе (дизель/прямой впрыск)','kraft',2,function(d){ return num((d[0]*256+d[1])*10/100,'bar',0); });
for (s=0;s<8;s++) (function(s){
  P(0x24+s,'Breitbandsonde S'+(s+1)+' (Lambda, Spannung)','ШДК S'+(s+1)+' (лямбда, напряжение)','gemisch',4,function(d){ var l = (d[0]*256+d[1])*2/65536, u = (d[2]*256+d[3])*8/65536; return {v:l, t:'λ '+fx(l,3)+' · '+fx(u,2)+' V', w:l<0.8||l>1.2, n:null}; },'k7');
  P(0x34+s,'Breitbandsonde S'+(s+1)+' (Lambda, Strom)','ШДК S'+(s+1)+' (лямбда, ток)','gemisch',4,function(d){ var l = (d[0]*256+d[1])*2/65536, i = (d[2]*256+d[3])/256-128; return {v:l, t:'λ '+fx(l,3)+' · '+fx(i,2)+' mA', w:l<0.8||l>1.2, n:['Strom ≈ 0 mA bei λ = 1, negativ = fett, positiv = mager','Ток ≈ 0 мА при λ = 1, минус = богато, плюс = бедно']}; },'k7');
})(s);
P(0x2C,'AGR Soll','EGR заданное','diesel',1,function(d){ return num(pct(d[0]),'%',0); });
P(0x2D,'AGR Abweichung','Ошибка EGR','diesel',1,function(d){ var v = trim(d[0]); return num(v,'%',0,Math.abs(v)>20); });
P(0x2E,'Tankentlüftung Soll','Продувка адсорбера заданная','abgas',1,function(d){ return num(pct(d[0]),'%',0); });
P(0x2F,'Tankfüllstand','Уровень топлива','kraft',1,function(d){ return num(pct(d[0]),'%',0); });
P(0x30,'Warmläufe seit Löschen','Прогревов после сброса','fahrt',1,function(d){ return num(d[0],'',0); });
P(0x31,'Strecke seit Löschen','Пробег после сброса ошибок','fahrt',2,function(d){ return num(d[0]*256+d[1],'km',0); });
P(0x32,'Tankentlüftung Dampfdruck','Давление паров в баке','abgas',2,function(d){ return num(s16(d[0],d[1])/4,'Pa',1); });
P(0x33,'Luftdruck (Umgebung)','Атмосферное давление','luft',1,function(d){ return num(d[0],'kPa',0,d[0]<70||d[0]>108); });
for (s=0;s<4;s++) (function(s){
  var nm = ['B1S1','B2S1','B1S2','B2S2'][s];
  P(0x3C+s,'Katalysatortemperatur '+nm,'Температура катализатора '+nm,'abgas',2,function(d){ var t = (d[0]*256+d[1])/10-40; return num(t,'°C',0,t>900); });
})(s);
P(0x41,'Prüfstatus dieser Fahrt','Готовность мониторов (текущая поездка)','elek',4,function(d){ return txt('0x'+d.slice(0,4).map(function(x){ return ('0'+x.toString(16)).slice(-2); }).join('')); });
P(0x42,'Steuergerätespannung','Напряжение блока управления','elek',2,function(d){ var v = (d[0]*256+d[1])/1000; return num(v,'V',2,v<12.2||v>15.2,['Motor läuft: 13,5–14,8 V','Мотор работает: 13,5–14,8 В']); },'k102');
P(0x43,'Absolute Last','Абсолютная нагрузка','motor',2,function(d){ return num((d[0]*256+d[1])*100/255,'%',0); },'k3');
P(0x44,'Lambda Soll','Заданная лямбда','gemisch',2,function(d){ return num((d[0]*256+d[1])*2/65536,'',3); },'k7');
P(0x45,'Drosselklappe relativ','Относит. положение дросселя','motor',1,function(d){ return num(pct(d[0]),'%',1); },'k9');
P(0x46,'Außentemperatur','Температура наружного воздуха','temp',1,function(d){ return num(d[0]-40,'°C',0); });
P(0x47,'Drosselklappe B','Дроссель, датчик B','motor',1,function(d){ return num(pct(d[0]),'%',1); },'k9');
P(0x48,'Drosselklappe C','Дроссель, датчик C','motor',1,function(d){ return num(pct(d[0]),'%',1); },'k9');
P(0x49,'Fahrpedal D','Педаль газа, датчик D','motor',1,function(d){ return num(pct(d[0]),'%',1); });
P(0x4A,'Fahrpedal E','Педаль газа, датчик E','motor',1,function(d){ return num(pct(d[0]),'%',1); });
P(0x4B,'Fahrpedal F','Педаль газа, датчик F','motor',1,function(d){ return num(pct(d[0]),'%',1); });
P(0x4C,'Drosselklappensteller Soll','Привод дросселя заданный','motor',1,function(d){ return num(pct(d[0]),'%',1); },'k9');
P(0x4D,'Zeit mit MIL an','Время с горящей MIL','fahrt',2,function(d){ var v = d[0]*256+d[1]; return num(v,'min',0,v>0); });
P(0x4E,'Zeit seit Löschen','Время после сброса ошибок','fahrt',2,function(d){ return num(d[0]*256+d[1],'min',0); });
P(0x4F,'Maximalwerte (λ, U, I, MAP)','Макс. значения (λ, U, I, MAP)','gemisch',4,function(d){ return txt('λ '+d[0]+' · '+d[1]+' V · '+d[2]+' mA · '+(d[3]*10)+' kPa'); });
P(0x50,'Maximale Luftmasse','Макс. расход воздуха','luft',1,function(d){ return num(d[0]*10,'g/s',0); });
P(0x51,'Kraftstoffart','Тип топлива','kraft',1,function(d){ return txt(FUEL_TYPE[d[0]]||('Typ '+d[0])); });
P(0x52,'Ethanolanteil','Доля этанола','kraft',1,function(d){ return num(pct(d[0]),'%',0); });
P(0x53,'Tankentlüftung Druck absolut','Абс. давление паров','abgas',2,function(d){ return num((d[0]*256+d[1])/200,'kPa',2); });
P(0x54,'Tankentlüftung Druck','Давление паров','abgas',2,function(d){ return num(s16(d[0],d[1]),'Pa',0); });
P(0x55,'Sekundär-Lambda Kurzzeit B1/B3','Вторичная лямбда, кратк. B1/B3','gemisch',1,function(d){ return num(trim(d[0]),'%',1); });
P(0x56,'Sekundär-Lambda Langzeit B1/B3','Вторичная лямбда, долг. B1/B3','gemisch',1,function(d){ return num(trim(d[0]),'%',1); });
P(0x57,'Sekundär-Lambda Kurzzeit B2/B4','Вторичная лямбда, кратк. B2/B4','gemisch',1,function(d){ return num(trim(d[0]),'%',1); });
P(0x58,'Sekundär-Lambda Langzeit B2/B4','Вторичная лямбда, долг. B2/B4','gemisch',1,function(d){ return num(trim(d[0]),'%',1); });
P(0x59,'Raildruck absolut','Абс. давление в рампе','kraft',2,function(d){ return num((d[0]*256+d[1])*10/100,'bar',0); });
P(0x5A,'Fahrpedal relativ','Относит. положение педали','motor',1,function(d){ return num(pct(d[0]),'%',1); });
P(0x5B,'Hybridbatterie Ladestand','Заряд гибридной батареи','elek',1,function(d){ return num(pct(d[0]),'%',0); });
P(0x5C,'Öltemperatur','Температура масла','temp',1,function(d){ var t = d[0]-40; return num(t,'°C',0,t>135); });
P(0x5D,'Einspritzzeitpunkt','Угол начала впрыска','kraft',2,function(d){ return num((d[0]*256+d[1])/128-210,'°',2); });
P(0x5E,'Kraftstoffverbrauch','Расход топлива','kraft',2,function(d){ return num((d[0]*256+d[1])/20,'l/h',2); });
P(0x5F,'Abgasnorm (Fahrzeug)','Экологический стандарт','abgas',1,function(d){ return txt({14:'Euro IV B1',15:'Euro V B2',16:'Euro C',17:'Euro VI'}[d[0]]||('Code '+d[0])); });
P(0x61,'Fahrerwunsch-Drehmoment','Запрос момента водителем','motor',1,function(d){ return num(d[0]-125,'%',0); });
P(0x62,'Ist-Drehmoment','Фактический момент','motor',1,function(d){ return num(d[0]-125,'%',0); });
P(0x63,'Bezugsdrehmoment','Опорный момент','motor',2,function(d){ return num(d[0]*256+d[1],'Nm',0); });
P(0x66,'Luftmassenmesser A','ДМРВ A','luft',3,function(d){ return num((d[1]*256+d[2])/32,'g/s',2); });
P(0x67,'Kühlmitteltemperatur Sensor 1/2','Температура ОЖ, датчики 1/2','temp',3,function(d){ return txt((d[1]-40)+' °C'+(d.length>2&&(d[0]&2)?' / '+(d[2]-40)+' °C':'')); },'k4');
P(0x68,'Ansauglufttemperatur Sensor 1/2','Темп. впускного воздуха, датчики 1/2','temp',3,function(d){ return txt((d[1]-40)+' °C'+(d.length>2&&(d[0]&2)?' / '+(d[2]-40)+' °C':'')); },'k12');
P(0x69,'AGR Soll / Ist','EGR заданное / фактическое','diesel',3,function(d){ return txt(fx(pct(d[1]),0)+' % / '+fx(pct(d[2]),0)+' %'); });
P(0x6A,'Diesel-Ansaugluftdrossel Soll/Ist','Дизельная заслонка впуска заданн./факт.','diesel',3,function(d){ return txt(fx(pct(d[1]),0)+' % / '+fx(pct(d[2]),0)+' %'); });
P(0x6B,'AGR-Temperatur','Температура EGR','diesel',2,function(d){ return num(d[1]-40,'°C',0); });
P(0x6C,'Drosselklappensteller Soll/Ist','Привод дросселя заданн./факт.','motor',3,function(d){ return txt(fx(pct(d[1]),0)+' % / '+fx(pct(d[2]),0)+' %'); },'k9');
P(0x6D,'Raildruck Soll / Ist','Давление в рампе заданн./факт.','kraft',5,function(d){ return txt(fx((d[1]*256+d[2])/10,0)+' / '+fx((d[3]*256+d[4])/10,0)+' bar'); });
P(0x6E,'Einspritzdruck Soll / Ist','Давление впрыска заданн./факт.','kraft',5,function(d){ return txt(fx((d[1]*256+d[2])/10,0)+' / '+fx((d[3]*256+d[4])/10,0)+' bar'); });
P(0x6F,'Verdichter-Eingangsdruck','Давление на входе компрессора','diesel',2,function(d){ return num(d[1],'kPa',0); });
P(0x70,'Ladedruck Soll / Ist','Давление наддува заданн./факт.','diesel',5,function(d){ return txt(fx((d[1]*256+d[2])*0.03125,0)+' / '+fx((d[3]*256+d[4])*0.03125,0)+' kPa'); });
P(0x71,'VTG-Steller Soll/Ist','Привод VGT заданн./факт.','diesel',3,function(d){ return txt(fx(pct(d[1]),0)+' % / '+fx(pct(d[2]),0)+' %'); });
P(0x72,'Wastegate Soll/Ist','Вестгейт заданн./факт.','diesel',3,function(d){ return txt(fx(pct(d[1]),0)+' % / '+fx(pct(d[2]),0)+' %'); });
P(0x73,'Abgasdruck','Давление выхлопа','abgas',3,function(d){ return num((d[1]*256+d[2])*0.01,'kPa',1); });
P(0x74,'Turbodrehzahl','Обороты турбины','diesel',3,function(d){ return num((d[1]*256+d[2])*10,'1/min',0); });
P(0x75,'Turbo-Temperatur (Verdichter)','Температура турбо (компрессор)','diesel',3,function(d){ return num(d[1]-40,'°C',0); });
P(0x76,'Turbo-Temperatur (Turbine)','Температура турбо (турбина)','diesel',3,function(d){ return num((d[1]*256+d[2])/10-40,'°C',0); });
P(0x77,'Ladeluftkühler-Temperatur','Температура после интеркулера','diesel',2,function(d){ return num(d[1]-40,'°C',0); });
P(0x78,'Abgastemperatur Bank 1','Температура выхлопа, банк 1','abgas',3,function(d){ return num((d[1]*256+d[2])/10-40,'°C',0,(d[1]*256+d[2])/10-40>850); });
P(0x79,'Abgastemperatur Bank 2','Температура выхлопа, банк 2','abgas',3,function(d){ return num((d[1]*256+d[2])/10-40,'°C',0); });
P(0x7A,'DPF Differenzdruck Bank 1','Перепад давления DPF, банк 1','abgas',3,function(d){ var v = s16(d[1],d[2])/100; return num(v,'kPa',2,v>15,['Hoher Differenzdruck: Filter beladen','Высокий перепад: фильтр забит']); });
P(0x7B,'DPF Differenzdruck Bank 2','Перепад давления DPF, банк 2','abgas',3,function(d){ return num(s16(d[1],d[2])/100,'kPa',2); });
P(0x7C,'DPF-Temperatur','Температура DPF','abgas',3,function(d){ return num((d[1]*256+d[2])/10-40,'°C',0); });
P(0x7F,'Motorlaufzeit gesamt','Общее время работы двигателя','fahrt',5,function(d){ var v = ((d[1]*16777216)+(d[2]<<16)+(d[3]<<8)+d[4]); return num(v/3600,'h',1); });
P(0x84,'Saugrohr-Oberflächentemperatur','Темп. поверхности впуска','temp',1,function(d){ return num(d[0]-40,'°C',0); });
P(0x87,'Saugrohrdruck (fein)','Давление во впуске (точно)','luft',3,function(d){ return num((d[1]*256+d[2])/32,'kPa',1); },'k10');
P(0x8D,'Drosselklappe G','Дроссель G','motor',1,function(d){ return num(pct(d[0]),'%',1); });
P(0x8E,'Reibmoment Motor','Момент трения двигателя','motor',1,function(d){ return num(d[0]-125,'%',0); });
P(0x9D,'Kraftstoffmassenstrom','Массовый расход топлива','kraft',2,function(d){ return num((d[0]*256+d[1])*0.02,'g/s',2); });
P(0x9E,'Abgasmassenstrom','Массовый расход выхлопа','abgas',2,function(d){ return num((d[0]*256+d[1])/5,'kg/h',1); });
P(0xA2,'Kraftstoffmenge je Hub','Цикловая подача','kraft',2,function(d){ return num((d[0]*256+d[1])/32,'mg/Hub',2); });
P(0xA4,'Getriebe: Ist-Gang','КПП: текущая передача','fahrt',4,function(d){ var g = d[1]>>4; return txt((g?g+'. Gang':'N/–')+((d[2]||d[3])?' · i='+fx((d[2]*256+d[3])/1000,3):'')); });
P(0xA6,'Kilometerstand','Пробег (одометр)','fahrt',4,function(d){ return num(((d[0]*16777216)+(d[1]<<16)+(d[2]<<8)+d[3])/10,'km',1); });

var BY = {}; L.forEach(function(p){ BY[p.pid] = p; });

// Antwort "41 0C 1A F8" (mit/ohne Leerzeichen, ggf. mehrere Steuergeräte) → Datenbytes
function parse(raw, pid){
  if (!raw) return null;
  var lines = String(raw).toUpperCase().split(/[\r\n]+/), want = '41'+('0'+pid.toString(16).toUpperCase()).slice(-2);
  for (var i=0;i<lines.length;i++){
    var h = lines[i].replace(/^[0-9A-F]+:/,'').replace(/[^0-9A-F]/g,'');
    var k = -1, from = 0;
    while ((from = h.indexOf(want, from)) >= 0){ if (from % 2 === 0){ k = from; break; } if (k < 0) k = from; from++; }
    if (k < 0) continue;
    var rest = h.slice(k+4), b = [];
    for (var j=0;j+1<rest.length;j+=2) b.push(parseInt(rest.substr(j,2),16));
    return b;
  }
  return null;
}
function decode(pid, bytes){
  if (!bytes) return null;
  var p = BY[pid];
  if (!p){ return {pid:pid, label:'PID '+hex(pid), text:bytes.map(function(x){ return ('0'+x.toString(16)).slice(-2); }).join(' ').toUpperCase(), warn:false, note:'', g:'elek'}; }
  if (!bytes || bytes.length < p.n) return null;
  var r; try { r = p.dec(bytes); } catch(e){ return null; }
  if (!r) return null;
  var ru = window.JCLANG==='ru';
  return {pid:pid, label:ru?p.ru:p.de, text:r.t, value:r.v, warn:r.w, note:r.n ? (ru?r.n[1]:r.n[0]) : '', chapter:p.ch, g:p.g};
}
function hex(pid){ return ('0'+pid.toString(16).toUpperCase()).slice(-2); }

// Unterstützte PIDs: 0100, 0120, 0140 … Bitmasken
async function supported(io, log){
  var out = [];
  for (var base=0; base<=0xE0; base+=0x20){
    var raw = await io.send('01'+hex(base), 6000), b = parse(raw, base);
    if (!b || b.length < 4){ if (log) log('01'+hex(base)+': '+(raw||'–').replace(/\s+/g,' ').slice(0,40)); break; }
    for (var i=0;i<32;i++) if (b[i>>3] & (128 >> (i&7))) out.push(base+i+1);
    if (!(b[3] & 1)) break;  // nächster Block nicht unterstützt
  }
  return out.filter(function(p){ return p % 0x20 !== 0; });
}
// Mehrere PIDs in einer Anfrage ("01 0C 0D 05 04"): Antwort = 41 PID Daten PID Daten …
function parseMulti(raw, group){
  var hexs = '', ls = String(raw||'').toUpperCase().split(/[\r\n]+/), i, res = {};
  for (i=0;i<ls.length;i++){ var l = ls[i].trim(); if (!l || /^[0-9A-F]{3}$/.test(l)) continue; hexs += l.replace(/^[0-9A-F]+:/,'').replace(/[^0-9A-F]/g,''); }
  var b = []; for (i=0;i+1<hexs.length;i+=2) b.push(parseInt(hexs.substr(i,2),16));
  var s = b.indexOf(0x41); if (s < 0) return res;
  var k = s+1;
  while (k < b.length){ var pid = b[k], def = BY[pid]; if (!def || group.indexOf(pid) < 0 || k+1+def.n > b.length) break; res[pid] = b.slice(k+1, k+1+def.n); k += 1+def.n; }
  return res;
}
// Eine Anfrage; "1" am Ende = nur 1 Antwort erwarten, der Adapter wartet dann nicht den ganzen Timeout ab
async function ask(io, cmd, to){
  var raw = await io.send(cmd + (io.__noN ? '' : '1'), to);
  if (!io.__noN && /^\s*\?/.test(String(raw)) && !/41/.test(String(raw))){ io.__noN = true; raw = await io.send(cmd, to); }
  return raw;
}
async function read(io, pids, onEach){
  var out = [], diag = [], woke = false, i, j, done = {};
  function take(pid, b){ var r = decode(pid, b); if (r){ out.push(r); done[pid] = 1; if (onEach) onEach(r, out); } return r; }
  // 1) Gruppen von bis zu 6 bekannten PIDs in einer Anfrage
  if (!io.__noMulti){
    var known = pids.filter(function(x){ return BY[x]; });
    for (i=0;i<known.length;i+=6){
      var g = known.slice(i, i+6); if (g.length < 2) continue;
      var raw0 = null, res = {}; try { raw0 = await ask(io, '01' + g.map(hex).join(''), 4000); res = parseMulti(raw0, g); } catch(e){ if (io.closed) throw e; }
      var okn = 0; g.forEach(function(x){ if (res[x]){ take(x, res[x]); okn++; } });
      if (!okn && !i){ io.__noMulti = true; break; }   // Steuergerät kann es nicht: einzeln weiter
    }
  }
  // 2) Rest einzeln
  for (j=0;j<pids.length;j++){
    var pid = pids[j]; if (done[pid]) continue;
    var raw = null, b = null;
    for (var t=0;t<2 && !b;t++){   // einmal wiederholen (BLE-Adapter verlieren gern die erste Antwort)
      try { raw = await ask(io, '01'+hex(pid), 4000); } catch(e){ raw = 'FEHLER: '+(e && e.message || e); if (io.closed) throw e; }
      b = parse(raw, pid);
      if (!b && !woke && /NO DATA/i.test(String(raw))){ woke = true; try { await io.send('ATSH7DF', 2000); await io.send('0100', 8000); } catch(e){} }
    }
    if (!b){ if (diag.length < 4) diag.push(hex(pid)+' → '+String(raw == null ? '–' : raw).replace(/\s+/g,' ').trim().slice(0,48)); continue; }
    if (!take(pid, b) && diag.length < 4) diag.push(hex(pid)+' → '+JSON.stringify(b).slice(0,40)+' (nicht lesbar)');
  }
  // Reihenfolge wie angefordert
  out.sort(function(x, y){ return pids.indexOf(x.pid) - pids.indexOf(y.pid); });
  out.diag = diag;
  return out;
}

// Demo-Antworten für alle Tabellen-PIDs
function demo(cmd, t){
  var c0 = cmd.replace(/\s/g,'').toUpperCase();
  if (/^01([0-9A-F]{2})+[0-9A-F]?$/.test(c0)){
    if (c0.length % 2) c0 = c0.slice(0,-1);          // Antwortanzahl-Ziffer
    if (c0.length > 4){                               // mehrere PIDs in einer Anfrage
      var s = '41';
      for (var q=2;q<c0.length;q+=2){ var r1 = demo1('01'+c0.substr(q,2), t); if (r1 && r1 !== 'NO DATA') s += r1.slice(2); }
      return s === '41' ? 'NO DATA' : s;
    }
    return demo1(c0, t);
  }
  return null;
}
function demo1(cmd, t){
  var c = cmd.replace(/\s/g,'').toUpperCase(); if (!/^01[0-9A-F]{2}$/.test(c)) return null;
  var pid = parseInt(c.slice(2),16);
  if (pid % 0x20 === 0){
    var bits = [0,0,0,0];
    L.forEach(function(p){ if (p.pid > pid && p.pid <= pid+0x20 && (p.pid < 0x60 || [0x67,0x68,0x6D,0x70,0x74,0x7A,0x7C,0xA6].indexOf(p.pid) >= 0) && [0x08,0x09,0x16,0x17,0x18,0x19,0x1A,0x1B,0x1D,0x1E,0x5B,0x52,0x26,0x27,0x28,0x29,0x2A,0x2B,0x36,0x37,0x38,0x39,0x3A,0x3B,0x3D,0x3F,0x57,0x58].indexOf(p.pid) < 0){ var k = p.pid-pid-1; bits[k>>3] |= 128 >> (k&7); } });
    if (pid < 0xA0) bits[3] |= 1;
    return '41'+hex(pid)+bits.map(function(x){ return ('0'+x.toString(16).toUpperCase()).slice(-2); }).join('');
  }
  var s = Math.sin(t/900), rpm = 820 + 40*Math.sin(t/300), v = function(x){ x = Math.max(0, Math.min(255, Math.round(x))); return ('0'+x.toString(16).toUpperCase()).slice(-2); };
  var map = {
    0x01:'000765'+'00', 0x03:'0200', 0x04:v(58+6*s), 0x05:v(88+40), 0x06:v(128+6*Math.sin(t/120)), 0x07:v(131), 0x0A:v(100), 0x0B:v(33+2*s),
    0x0C:v(rpm*4/256)+v((rpm*4)%256), 0x0D:'00', 0x0E:v((8+3*s+64)*2), 0x0F:v(24+40), 0x10:'01'+v(130+10*s), 0x11:v(38), 0x13:'03', 0x14:v(90+80*Math.sin(t/180))+'80', 0x15:v(140)+'FF',
    0x1C:'06', 0x1F:v((t/1000/256))+v((t/1000)%256), 0x21:'0000', 0x23:'01'+v(130), 0x24:'80'+v(0)+'80'+'00', 0x25:'80'+'40'+'8C'+'00', 0x2C:'00', 0x2D:'80', 0x2E:v(40), 0x2F:v(150),
    0x30:'2A', 0x31:'04'+'D2', 0x32:'0010', 0x33:'62', 0x34:'80'+v(10)+'80'+v(6), 0x35:'8040'+'7F'+'F0', 0x3C:'1C'+'20', 0x3E:'15'+'E0', 0x41:'00076500', 0x42:'36'+'B0', 0x43:'00'+v(45), 0x44:'80'+'00', 0x45:v(10), 0x46:v(18+40),
    0x47:v(38), 0x48:v(38), 0x49:v(36), 0x4A:v(18), 0x4B:v(18), 0x4C:v(10), 0x4D:'0000', 0x4E:'01'+'2C', 0x4F:'02FFFF0A', 0x50:'1E', 0x51:'01', 0x53:'4E'+'84', 0x54:'0008', 0x55:v(128), 0x56:v(129),
    0x59:'01'+'90', 0x5A:v(0), 0x5C:v(95+40), 0x5D:'6A'+'00', 0x5E:'00'+v(16+2*s), 0x5F:'11',
    0x67:'01'+v(128), 0x68:'01'+v(64), 0x6D:'0F'+'0E'+'10'+'0E'+'0A', 0x70:'0F'+'0C'+'80'+'0C'+'60', 0x74:'01'+'0F'+'A0', 0x7A:'01'+'00'+'5A', 0x7C:'01'+'0F'+'A0', 0xA6:'00'+'12'+'D6'+'87'
  };
  var d = map[pid]; if (d == null) return 'NO DATA';
  return '41'+hex(pid)+d;
}

var PRESETS = {
  basis:{de:'Grundwerte',ru:'Основные',p:[0x05,0x0C,0x0D,0x04,0x0F,0x0B,0x10,0x11,0x42]},
  gemisch:{de:'Gemisch / Lambda',ru:'Смесь / лямбда',p:[0x03,0x06,0x07,0x08,0x09,0x14,0x15,0x24,0x34,0x44,0x0C,0x10]},
  leerlauf:{de:'Leerlauf / Falschluft',ru:'ХХ / подсос воздуха',p:[0x0C,0x0B,0x10,0x06,0x07,0x0E,0x11,0x05,0x0F]},
  kat:{de:'Katalysator',ru:'Катализатор',p:[0x14,0x15,0x3C,0x3E,0x24,0x25,0x34,0x35,0x05,0x0C]},
  diesel:{de:'Diesel / Turbo / DPF',ru:'Дизель / турбо / DPF',p:[0x0C,0x23,0x59,0x6D,0x70,0x0B,0x10,0x2C,0x2D,0x69,0x7A,0x7C,0x78,0x5E]},
  start:{de:'Start / Elektrik',ru:'Пуск / электрика',p:[0x42,0x0C,0x05,0x01,0x1F,0x46,0x5C]},
  fahrt:{de:'Zähler / Fahrt',ru:'Счётчики / поездка',p:[0x0D,0x31,0x30,0x21,0x4D,0x4E,0x1F,0xA6,0x2F,0x5E]}
};

window.JCPID = {list:L, by:BY, groups:G, parse:parse, decode:decode, supported:supported, read:read, demo:demo, hex:hex, presets:PRESETS};
})();
