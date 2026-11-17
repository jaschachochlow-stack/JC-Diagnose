/* Mode 06 (SAE J1979 / ISO 15031-5): Ergebnisse der Selbsttests des Motorsteuergeräts.
   Antwort 46 <MID> {MID TID UASID Wert(2) Min(2) Max(2)} je Test. Einheiten nach J1979-Tabelle (UASID). */
(function(){
  function H(n){ return ('0'+n.toString(16).toUpperCase()).slice(-2); }
  // [Faktor, Einheit, Offset] – unsignierte IDs 0x01…; 0x80 + ID = gleiche Skalierung, signiert
  var UAS = {
    0x01:[1,''],0x02:[0.1,''],0x03:[0.01,''],0x04:[0.001,''],0x05:[0.0000305,''],0x06:[0.000305,''],0x07:[0.25,'min⁻¹'],0x08:[0.01,'km/h'],0x09:[1,'km/h'],
    0x0A:[0.000122,'V'],0x0B:[0.001,'V'],0x0C:[0.01,'V'],0x0D:[0.00390625,'mA'],0x0E:[0.001,'A'],0x0F:[0.01,'A'],0x10:[1,'ms'],0x11:[100,'ms'],0x12:[1,'s'],
    0x13:[1,'mΩ'],0x14:[1,'Ω'],0x15:[1,'kΩ'],0x16:[0.1,'°C',-40],0x17:[0.01,'kPa'],0x18:[0.0117,'kPa'],0x19:[0.079,'kPa'],0x1A:[1,'kPa'],0x1B:[10,'kPa'],
    0x1C:[0.01,'°'],0x1D:[0.5,'°'],0x1E:[0.0000305,''],0x1F:[0.05,''],0x20:[0.00390625,''],0x21:[0.001,'Hz'],0x22:[1,'Hz'],0x23:[1,'kHz'],0x24:[1,'Zähler'],0x25:[1,'km'],
    0x27:[0.01,'g/s'],0x28:[1,'g/s'],0x2F:[0.01,'%'],0x30:[0.001526,'%'],0x31:[0.001,'l'],0x34:[1,'min'],0x35:[10,'ms'],0x3C:[0.1,'µs'],0x40:[1,'ppm']
  };
  var MID = {};
  for (var b=0;b<4;b++) for (var s=0;s<4;s++){ var tag = 'B'+(b+1)+'S'+(s+1); MID[1+b*4+s] = ['Lambdasonde '+tag,'Лямбда-зонд '+tag,'lambda']; MID[0x41+b*4+s] = ['Lambdasonden-Heizung '+tag,'Подогрев лямбда-зонда '+tag,'heater']; }
  for (b=1;b<=4;b++){ MID[0x20+b] = ['Katalysator Bank '+b,'Катализатор, ряд '+b,'kat']; MID[0x30+b] = ['AGR Bank '+b,'EGR, ряд '+b,'agr']; MID[0x34+b] = ['Nockenwellenverstellung Bank '+b,'VVT, ряд '+b,'vvt']; MID[0x60+b] = ['Beheizter Katalysator Bank '+b,'Греющийся катализатор, ряд '+b,'kat']; MID[0x70+b] = ['Sekundärluft '+b,'Вторичный воздух '+b,'air']; MID[0x80+b] = ['Kraftstoffsystem Bank '+b,'Топливная система, ряд '+b,'fuel']; }
  MID[0x39] = ['Tankentlüftung (EVAP) 0,150 Zoll / Deckel ab','EVAP 0,150″ / крышка снята','evap']; MID[0x3A] = ['Tankentlüftung (EVAP) 0,090 Zoll','EVAP 0,090″','evap']; MID[0x3B] = ['Tankentlüftung (EVAP) 0,040 Zoll','EVAP 0,040″','evap']; MID[0x3C] = ['Tankentlüftung (EVAP) 0,020 Zoll','EVAP 0,020″','evap']; MID[0x3D] = ['Spülstrom (Purge Flow)','Поток продувки (Purge)','evap'];
  MID[0x85] = ['Ladedruckregelung Bank 1','Контроль наддува, ряд 1','boost']; MID[0x86] = ['Ladedruckregelung Bank 2','Контроль наддува, ряд 2','boost'];
  MID[0x90] = ['NOx-Speicher Bank 1','NOx-абсорбер, ряд 1','nox']; MID[0x91] = ['NOx-Speicher Bank 2','NOx-абсорбер, ряд 2','nox']; MID[0x98] = ['NOx-Katalysator Bank 1','NOx-катализатор, ряд 1','nox']; MID[0x99] = ['NOx-Katalysator Bank 2','NOx-катализатор, ряд 2','nox'];
  MID[0xA1] = ['Zündaussetzer gesamt','Пропуски зажигания, всего','misfire']; for (var c=1;c<=12;c++) MID[0xA1+c] = ['Zündaussetzer Zylinder '+c,'Пропуски зажигания, цилиндр '+c,'misfire'];
  MID[0xB0] = ['Partikelfilter Bank 1','Сажевый фильтр, ряд 1','dpf']; MID[0xB1] = ['Partikelfilter Bank 2','Сажевый фильтр, ряд 2','dpf'];
  // Standard-TIDs der Lambdasonden-Monitore (J1979)
  var TID_O2 = {1:['Schwelle fett→mager','Порог богатая→бедная'],2:['Schwelle mager→fett','Порог бедная→богатая'],3:['Sondenspannung niedrig (Schaltzeit)','Низкое напряжение (время переключения)'],4:['Sondenspannung hoch (Schaltzeit)','Высокое напряжение (время переключения)'],5:['Schaltzeit fett→mager','Время богатая→бедная'],6:['Schaltzeit mager→fett','Время бедная→богатая'],7:['Min. Sondenspannung im Testzyklus','Мин. напряжение за цикл'],8:['Max. Sondenspannung im Testzyklus','Макс. напряжение за цикл'],9:['Zeit zwischen Sprüngen','Время между переключениями'],10:['Sondenperiode','Период зонда']};

  function val(uas, b0, b1){
    var hi = !!(uas & 0x80), id = uas & 0x7F, d = UAS[id]; if (!d) return null;
    var raw = b0*256 + b1; if (hi && raw > 32767) raw -= 65536;
    var v = raw*d[0] + (d[2]||0); return {v:v, u:d[1]};
  }
  function fmt(x){ if (x == null) return '–'; var a = Math.abs(x); var n = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : 4; return String(+x.toFixed(n)).replace('.',','); }
  function toBytes(raw){
    var ls = String(raw||'').toUpperCase().split(/[\r\n]+/), h = '', i;
    for (i=0;i<ls.length;i++){ var l = ls[i].trim(); if (!l || /^[0-9A-F]{3}$/.test(l) || /SEARCHING|NO DATA|UNABLE|ERROR|STOPPED|^\?|BUS/.test(l)) continue; h += l.replace(/^[0-9A-F]{1,3}:/,'').replace(/[^0-9A-F]/g,''); }
    var b = []; for (i=0;i+1<h.length;i+=2) b.push(parseInt(h.substr(i,2),16)); return b;
  }
  function parse(raw, mid){   // → Liste der Testergebnisse oder null
    var b = toBytes(raw), s = b.indexOf(0x46); while (s >= 0 && b[s+1] !== mid) s = b.indexOf(0x46, s+1);
    if (s < 0) return null;
    var d = b.slice(s+1), out = [];
    for (var n=0; n+9<=d.length; n+=9){
      var g = d.slice(n, n+9), v = val(g[2], g[3], g[4]), lo = val(g[2], g[5], g[6]), hi = val(g[2], g[7], g[8]);
      var t = {mid:g[0], tid:g[1], uas:g[2], raw:[(g[3]<<8)|g[4], (g[5]<<8)|g[6], (g[7]<<8)|g[8]]};
      if (v && lo && hi){ t.v = v.v; t.lo = lo.v; t.hi = hi.v; t.u = v.u; t.ok = t.v >= t.lo && t.v <= t.hi; var span = t.hi - t.lo; t.edge = !!(t.ok && span > 0 && ((t.hi - t.v) < span*0.1 || (t.lo > 0 && (t.v - t.lo) < span*0.1)) && !(t.hi >= 65000*(UAS[g[2]&127][0]||1)*0.99)); }
      else { t.ok = null; }
      out.push(t);
    }
    return out;
  }
  async function ask(io, cmd, to){
    var raw = await io.send(cmd + (io.__noN ? '' : '1'), to);
    if (!io.__noN && /^\s*\?/.test(String(raw)) && !/46/.test(String(raw))){ io.__noN = true; raw = await io.send(cmd, to); }
    return raw;
  }
  async function supported(io){
    var out = [];
    for (var base=0; base<=0xE0; base+=0x20){
      var raw = await ask(io, '06'+H(base), 6000), b = toBytes(raw), s = b.indexOf(0x46);
      if (s < 0 || b[s+1] !== base || b.length < s+6) break;
      for (var i=0;i<32;i++) if (b[s+2+(i>>3)] & (128 >> (i&7))) out.push(base+i+1);
      if (!(b[s+5] & 1)) break;
    }
    return out.filter(function(m){ return m % 0x20 !== 0; });
  }
  async function readAll(io, onEach, mids){
    var list = mids || await supported(io), res = [];
    for (var i=0;i<list.length;i++){
      var raw = ''; try { raw = await ask(io, '06'+H(list[i]), 6000); } catch(e){ if (io.closed) throw e; }
      var tests = parse(raw, list[i]); var r = {mid:list[i], tests:tests || [], raw:tests ? '' : String(raw||'').replace(/\s+/g,' ').slice(0,40)};
      res.push(r); if (onEach) onEach(r, res);
    }
    res.list = list; return res;
  }
  function name(mid, ru){ var m = MID[mid]; return m ? m[ru ? 1 : 0] : 'MID '+H(mid); }
  function tidName(mid, tid, ru){ var m = MID[mid]; if (m && m[2] === 'lambda' && TID_O2[tid]) return TID_O2[tid][ru ? 1 : 0]; return 'TID '+H(tid)+(tid >= 0x80 ? (ru ? ' (производитель)' : ' (herstellerspezifisch)') : ''); }

  // Demo: Beispiel-Steuergerät mit einem Test nahe am Grenzwert und einem Fehler
  var DEMO = { 0x02:[[0x07,0x0A,0x0200,0x00C8,0x0800],[0x08,0x0A,0x1B00,0x1000,0x2000]], 0x21:[[0x80,0x24,0x0010,0x0000,0xFFFF],[0xA9,0x0A,0x1000,0x0800,0x2000]], 0xA1:[[0x80,0x24,0x0003,0x0000,0x0064],[0x0B,0x24,0x0000,0x0000,0x0010]], 0xA3:[[0x80,0x24,0x0044,0x0000,0x0040]], 0x3D:[[0x81,0x2F,0x0640,0x0100,0x1800]] };
  function demo(cmd){
    var c = cmd.replace(/\s/g,'').toUpperCase(); if (c.length % 2) c = c.slice(0,-1);
    if (!/^06[0-9A-F]{2}$/.test(c)) return null;
    var mid = parseInt(c.slice(2),16);
    if (mid % 0x20 === 0){
      var bits = [0,0,0,0]; Object.keys(DEMO).forEach(function(k){ k = +k; if (k > mid && k <= mid+0x20){ var i = k-mid-1; bits[i>>3] |= 128 >> (i&7); } });
      if (mid < 0xA0) bits[3] |= 1; return '46'+H(mid)+bits.map(H).join('');
    }
    var t = DEMO[mid]; if (!t) return 'NO DATA';
    var s = '46'; t.forEach(function(x){ s += H(mid)+H(x[0])+H(x[1])+('000'+x[2].toString(16)).slice(-4).toUpperCase()+('000'+x[3].toString(16)).slice(-4).toUpperCase()+('000'+x[4].toString(16)).slice(-4).toUpperCase(); }); return s;
  }
  window.JCM06 = {parse:parse, supported:supported, readAll:readAll, name:name, tidName:tidName, fmt:fmt, demo:demo, MID:MID, UAS:UAS, hex:H};
})();
