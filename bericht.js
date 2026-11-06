/* JC Diagnose: Import von Berichten anderer Diagnosegeräte (Launch X431, Autel, Bosch, Foxwell, Thinkdiag u. a.)
   Liest Fahrzeugdaten und Fehlercodes aus PDF, Text, CSV, HTML. Ergebnis -> window.JCREP */
(function(){
  var CODE_RE = /(^|[^A-Za-z0-9])([PBCU][0-3][0-9A-F]{3})(?:\s?[-–\/]\s?([0-9A-F]{2}))?(?![A-Za-z0-9])/g;
  var ST = [
    ['active', /\b(aktiv|aktuell|active|current|present|jetzt|vorhanden|ist\s+aktiv)\b|активн|текущ/i],
    ['pending', /\b(anstehend|pending|unbest[aä]tigt|unconfirmed)\b|ожида/i],
    ['permanent', /\b(permanent|dauerhaft)\b|постоянн/i],
    ['stored', /\b(gespeichert|gespeichert|stored|history|historisch|historie|saved|confirmed|bestätigt|sporadisch|intermittent|vergangen|inaktiv|inactive)\b|сохран|истори|прошл/i]
  ];
  function statusOf(s){ for (var i=0;i<ST.length;i++){ var m = ST[i][1].exec(s); if (m) return {st:ST[i][0], m:m[0], idx:m.index}; } return null; }

  /* ---------- Fehlerart (FTB, SAE J2012) ---------- */
  var FTB = {
    '01':['allgemeiner Fehler','общая ошибка',''],
    '02':['allgemeiner Signalfehler','общая ошибка сигнала',''],
    '04':['Systeminterner Fehler','внутренняя ошибка системы','soft'],
    '11':['Kurzschluss nach Masse','замыкание на массу','short_g'],
    '12':['Kurzschluss nach Plus','замыкание на плюс','short_b'],
    '13':['Unterbrechung (offener Stromkreis)','обрыв цепи','open'],
    '14':['Kurzschluss nach Masse oder Unterbrechung','замыкание на массу или обрыв','short_g_open'],
    '15':['Kurzschluss nach Plus oder Unterbrechung','замыкание на плюс или обрыв','short_b_open'],
    '16':['Spannung unter Schwellwert','напряжение ниже порога','volt'],
    '17':['Spannung über Schwellwert','напряжение выше порога','volt'],
    '19':['Strom über Schwellwert','ток выше порога','short_b'],
    '1A':['Widerstand unter Schwellwert','сопротивление ниже порога','short_g'],
    '1B':['Widerstand über Schwellwert','сопротивление выше порога','open'],
    '21':['Signalamplitude zu klein','амплитуда сигнала слишком мала','signal'],
    '22':['Signalamplitude zu groß','амплитуда сигнала слишком велика','signal'],
    '23':['Signal bleibt niedrig','сигнал застрял на низком','signal'],
    '24':['Signal bleibt hoch','сигнал застрял на высоком','signal'],
    '29':['Signal ungültig','сигнал недействителен','signal'],
    '31':['kein Signal','нет сигнала','open'],
    '41':['Prüfsummenfehler','ошибка контрольной суммы','soft'],
    '42':['Speicherfehler','ошибка памяти','soft'],
    '49':['interner Elektronikfehler','внутренняя ошибка электроники','soft'],
    '62':['Signalvergleich fehlerhaft','ошибка сравнения сигналов','signal'],
    '64':['Signal nicht plausibel','сигнал неправдоподобен','signal'],
    '71':['Aktuator klemmt','актуатор заклинил','mech'],
    '72':['Aktuator klemmt offen','актуатор заклинил в открытом','mech'],
    '73':['Aktuator klemmt geschlossen','актуатор заклинил в закрытом','mech'],
    '7A':['Aktuator außerhalb Position','актуатор вне положения','mech'],
    '92':['Leistung außerhalb Bereich','мощность вне диапазона','signal'],
    '96':['Bauteil intern defekt','компонент неисправен внутри','soft'],
    '97':['Bauteil/System-Betrieb falsch','неверная работа компонента/системы','signal'],
    '98':['Bauteil über Temperatur','компонент перегрет','signal']
  };
  var HINT = {
    open:['Leitung und Stecker durchmessen: Durchgang, Pin-Spannung, Korrosion, Massepunkt des Bauteils.','Прозвони провод и разъём: целостность, напряжение на пине, коррозия, масса компонента.'],
    short_b:['Leitung auf Scheuerstellen und Wasser im Stecker prüfen. Bauteil abstecken: kommt der Fehler weg, liegt der Fehler im Bauteil, sonst in der Leitung.','Проверь провод на потёртости и воду в разъёме. Отключи компонент: пропала ошибка — виноват компонент, нет — провод.'],
    short_g:['Leitung auf Scheuerstellen prüfen. Bauteil abstecken und Widerstand gegen Masse messen.','Проверь провод на потёртости. Отключи компонент и измерь сопротивление на массу.'],
    short_b_open:['Zwei Fälle: Kurzschluss nach Plus oder Unterbrechung. Erst Spannung am abgesteckten Stecker messen, dann Durchgang der Leitung.','Два варианта: замыкание на плюс или обрыв. Сначала напряжение на отключённом разъёме, потом целостность провода.'],
    short_g_open:['Zwei Fälle: Kurzschluss nach Masse oder Unterbrechung. Erst Widerstand gegen Masse, dann Durchgang der Leitung.','Два варианта: замыкание на массу или обрыв. Сначала сопротивление на массу, потом целостность провода.'],
    volt:['Spannungsversorgung des Bauteils bzw. Steuergeräts messen (Batterie, Sicherung, Masse), auch unter Last.','Измерь питание компонента или блока (АКБ, предохранитель, масса), в том числе под нагрузкой.'],
    signal:['Signal mit Oszilloskop oder Istwerten gegen Sollwert prüfen, Stecker und Leitung ansehen, Bauteil auf mechanische Ursache prüfen.','Сравни сигнал осциллографом или живыми данными с нормой, осмотри разъём и провод, проверь механику компонента.'],
    soft:['Steuergerät-Interner Fehler: erst Spannungsversorgung und Massen prüfen, Softwarestand prüfen (Updates), Fehler löschen und beobachten, erst danach Steuergerät tauschen oder programmieren.','Внутренняя ошибка блока: сначала питание и массы, версия ПО (обновления), стереть ошибку и понаблюдать, только потом менять или прошивать блок.'],
    mech:['Mechanik des Aktuators prüfen (Schwergängigkeit, Verschmutzung, Gestänge), danach Ansteuerung.','Проверь механику актуатора (тугой ход, загрязнение, тяги), потом управление.']
  };
  function ftbInfo(f){
    if (!f || f==='00') return null;
    var e = FTB[f.toUpperCase()]; if (!e) return {ftb:f, de:'Fehlerart '+f, ru:'тип ошибки '+f, hint:null};
    var h = e[2] && HINT[e[2]] ? HINT[e[2]] : null;
    return {ftb:f, de:e[0], ru:e[1], hint:h ? {de:h[0], ru:h[1]} : null, kind:e[2]};
  }

  /* ---------- Kopfdaten ---------- */
  function pick(text, re){ var m = re.exec(text); return m ? m[1].replace(/\s+/g,' ').trim() : ''; }
  function parseHeader(text){
    var t = String(text||'');
    var vin = '';
    var vm = /(?:FIN|VIN|Fahrgestell(?:nummer)?|Fahrzeug-?Identnummer|Идентификационный)\s*[:=]?\s*([A-HJ-NPR-Z0-9]{17})\b/i.exec(t) || /\b([A-HJ-NPR-Z0-9]{17})\b/.exec(t);
    if (vm) vin = vm[1].toUpperCase();
    var fz = {
      vin: vin,
      marke: pick(t, /(?:Fahrzeugmarke|Marke|Hersteller|Make|Brand)\s*[:=]\s*([^\n\r:]+?)(?=\s{2,}|\n|\r|$|Fahrzeugmodell|Modell|Model\b)/i),
      modell: pick(t, /(?:Fahrzeugmodell|Modell|Model)\s*[:=]\s*([^\n\r:]+?)(?=\s{2,}|\n|\r|$|FIN|VIN)/i),
      jahr: pick(t, /(?:Modelljahr|Baujahr|Model\s*year|Year)\s*[:=]\s*((?:19|20)\d\d)/i),
      motor: pick(t, /(?:Engine(?:\s*Size)?|Motor(?:isierung)?)\s*[:=]\s*([^\n\r]+?)(?=\s{2,}|\n|\r|$|Pr[üu]fzeit)/i),
      km: pick(t, /(?:Kilometerstand|Laufleistung|Odometer|Mileage)\s*[:=]\s*([\d.,' ]+)\s*(?:km|mi)?/i).replace(/[^\d]/g,''),
      kz: pick(t, /(?:Kfz-Kennzeichen|Kennzeichen|License\s*plate|Plate)\s*[:=]\s*([A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 \-]{2,12})(?=\s*(?:\n|\r|$|Modelljahr))/i),
      datum: pick(t, /(?:Pr[üu]fzeit|Datum|Date|Zeit)\s*[:=]\s*(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?|\d{1,2}\.\d{1,2}\.\d{2,4}(?:\s+\d{1,2}:\d{2})?)/i),
      sw: pick(t, /(?:Fahrzeug-?Softwareversion|Software\s*version)\s*[:=]\s*([^\s]+)/i)
    };
    fz.marke = fz.marke.replace(/\s*(Fahrzeugmodell|Modell|FIN).*$/i,'');
    var dev = /(LAUNCH|X-?431|AUTEL|MaxiSys|BOSCH|KTS|FOXWELL|THINKDIAG|TOPDON|DELPHI|SNAP-?ON|HELLA|TEXA|GOLO|ANCEL|KONNWEI|VGATE|OBDLINK|CARISTA)\b/i.exec(t);
    fz.geraet = dev ? dev[1].toUpperCase().replace(/^X-?431$/,'LAUNCH X431') : '';
    return fz;
  }
  function modulOf(pre){
    var segs = String(pre||'').split('>').map(function(s){ return s.replace(/\s+/g,' ').trim(); }).filter(Boolean);
    for (var i=segs.length-1;i>0;i--) if (/^(Fehlercode|Fehlerspeicher|Read|DTC|Codes?|Лист|Чтение)/i.test(segs[i])) return segs[i-1];
    return '';
  }

  /* ---------- Textmodus (Fallback, auch für eingefügten Text) ---------- */
  function cleanDesc(s){
    return String(s||'').replace(/\s+/g,' ').replace(/^[\s\-–:;,|]+|[\s\-–:;,|]+$/g,'')
      .replace(/\b(Fehlercod\w*|Beschreibung|Zustand|Status|Description|Code)\b\s*$/i,'').trim();
  }
  function parseCodes(text){
    var t = String(text||''), hits = [], m;
    CODE_RE.lastIndex = 0;
    while ((m = CODE_RE.exec(t))){
      var start = m.index + m[1].length;
      hits.push({code:m[2].toUpperCase(), ftb:(m[3]||'').toUpperCase().replace(/^00$/,''), start:start, end:CODE_RE.lastIndex});
    }
    var out = [];
    for (var i=0;i<hits.length;i++){
      var body = t.slice(hits[i].end, i+1<hits.length ? hits[i+1].start : Math.min(t.length, hits[i].end+240));
      var nl = body.split(/\n\s*\n/)[0];
      var st = statusOf(nl), desc = nl;
      if (st) desc = nl.slice(0, st.idx) + ' ' + nl.slice(st.idx + st.m.length);
      out.push({code:hits[i].code, ftb:hits[i].ftb, desc:cleanDesc(desc), status:st ? st.st : 'stored', statusKnown:!!st});
    }
    return out;
  }
  function dedupe(list){
    var by = {}, out = [], rank = {active:0, pending:1, permanent:2, stored:3};
    list.forEach(function(c){
      var k = c.code + '-' + (c.ftb||'') + '@' + (c.module||'');
      var o = by[k];
      if (!o){ by[k] = c; out.push(c); return; }
      if (rank[c.status] < rank[o.status]) o.status = c.status;
      if (!o.desc && c.desc) o.desc = c.desc;
    });
    return out;
  }
  function parseText(text){
    var t = String(text||'').replace(/\r/g,'');
    var fz = parseHeader(t);
    var codes = parseCodes(t.replace(fz.vin || '\u0000', ' '));
    var mod = modulOf(t.slice(0, 1200));
    codes.forEach(function(c){ c.module = mod; });
    return {fz:fz, codes:dedupe(codes), text:t};
  }

  /* ---------- PDF ---------- */
  var pdfReady = null;
  function loadScript(src){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function(){ rej(new Error('Skript nicht geladen: '+src)); }; document.head.appendChild(s); }); }
  function loadPdfJs(){
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfReady) pdfReady = loadScript('pdf.min.js?v=0101').then(function(){ window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js?v=0101'; return window.pdfjsLib; });
    return pdfReady;
  }
  function groupLines(items, tol){
    var rows = [];
    items.slice().sort(function(a,b){ return a.y-b.y || a.x-b.x; }).forEach(function(it){
      var r = rows[rows.length-1];
      if (r && Math.abs(r.y - it.y) <= tol){ r.items.push(it); r.y = (r.y*(r.items.length-1) + it.y)/r.items.length; }
      else rows.push({y:it.y, items:[it]});
    });
    rows.forEach(function(r){ r.items.sort(function(a,b){ return a.x-b.x; }); r.text = r.items.map(function(i){ return i.s; }).join(' ').replace(/\s+/g,' ').trim(); });
    return rows;
  }
  /* Tabelle mit Spalten Code | Beschreibung | Zustand: Zeilen mit Mehrzeilentexten richtig zuordnen */
  function tableFromPage(items, cols, fromY){
    var body = items.filter(function(i){ return i.y > fromY + 2; });
    var c1 = body.filter(function(i){ return i.x < cols.c2 - 4; });
    var c2 = body.filter(function(i){ return i.x >= cols.c2 - 4 && i.x < cols.c3 - 4; });
    var c3 = body.filter(function(i){ return i.x >= cols.c3 - 4; });
    var codeRows = groupLines(c1, 3), codes = [];
    codeRows.forEach(function(r){
      CODE_RE.lastIndex = 0; var m = CODE_RE.exec(r.text);
      if (m) codes.push({code:m[2].toUpperCase(), ftb:(m[3]||'').toUpperCase().replace(/^00$/,''), y:r.y});
    });
    if (!codes.length) return [];
    var stRows = groupLines(c3, 3).filter(function(r){ return statusOf(r.text); });
    var lines = groupLines(c2, 3);
    codes.forEach(function(c, i){
      var s = stRows.length === codes.length ? stRows[i] : null;
      c.status = s ? statusOf(s.text).st : null;
      c.anchor = s ? (c.y + s.y)/2 : c.y;
    });
    // Beschreibungszeilen in N aufeinanderfolgende Gruppen teilen (Mitte der Gruppe ~ Mitte der Tabellenzeile)
    var N = codes.length, Lc = lines.length, INF = 1e15, EMPTY = 900;
    var dp = [], bk = [];
    for (var i=0;i<=N;i++){ dp.push(new Array(Lc+1).fill(INF)); bk.push(new Array(Lc+1).fill(0)); }
    dp[0][0] = 0;
    for (i=1;i<=N;i++){
      for (var j=0;j<=Lc;j++){
        for (var k=0;k<=j;k++){
          if (dp[i-1][k] >= INF) continue;
          var cost = 0;
          if (k === j) cost = EMPTY; else for (var q=k;q<j;q++) cost += Math.pow(lines[q].y - codes[i-1].anchor, 2);
          var v = dp[i-1][k] + cost;
          if (v < dp[i][j]){ dp[i][j] = v; bk[i][j] = k; }
        }
      }
    }
    var j2 = Lc;
    for (i=N;i>=1;i--){ var k2 = bk[i][j2]; codes[i-1].desc = cleanDesc(lines.slice(k2, j2).map(function(l){ return l.text; }).join(' ')); j2 = k2; }
    return codes.map(function(c){ return {code:c.code, ftb:c.ftb, desc:c.desc||'', status:c.status || 'stored', statusKnown:!!c.status}; });
  }
  function fromPdf(buf){
    return loadPdfJs().then(function(lib){
      return lib.getDocument({data:new Uint8Array(buf)}).promise;
    }).then(function(pdf){
      var pages = [], p = Promise.resolve();
      for (var n=1;n<=pdf.numPages;n++) (function(n){ p = p.then(function(){ return pdf.getPage(n).then(function(pg){ return pg.getTextContent(); }).then(function(tc){
        pages.push(tc.items.filter(function(i){ return i.str && i.str.trim(); }).map(function(i){ return {s:i.str.trim(), x:i.transform[4], y:-i.transform[5]}; }));
      }); }); })(n);
      return p.then(function(){ return pages; });
    }).then(function(pages){
      var fullText = [], tcodes = [], cols = null;
      pages.forEach(function(items){
        var rows = groupLines(items, 3);
        fullText.push(rows.map(function(r){ return r.text; }).join('\n'));
        // Kopfzeile der Tabelle suchen
        var hdr = rows.find(function(r){
          var t = r.text; return /(Beschreibung|Description|Описание)/i.test(t) && /(Zustand|Status|Состояние)/i.test(t);
        });
        var pageCols = null, hy = null;
        if (hdr){
          var near = items.filter(function(i){ return Math.abs(i.y - hdr.y) < 14; });
          var f1 = near.find(function(i){ return /(Fehlercod|DTC|^Code)/i.test(i.s); });
          var f2 = near.find(function(i){ return /(Beschreibung|Description|Описание)/i.test(i.s); });
          var f3 = near.find(function(i){ return /(Zustand|Status|Состояние)/i.test(i.s); });
          if (f2 && f3){ pageCols = {c2:f2.x, c3:f3.x}; hy = Math.max.apply(null, near.map(function(i){ return i.y; })); cols = pageCols; }
        } else if (cols) { pageCols = cols; hy = null; }
        if (pageCols){
          var pre = hy !== null ? rows.filter(function(r){ return r.y < hy; }).map(function(r){ return r.text; }).join(' ') : '';
          var mod = modulOf(pre);
          tableFromPage(items, pageCols, hy === null ? -1e9 : hy).forEach(function(c){ c.module = mod; tcodes.push(c); });
        }
      });
      var text = fullText.join('\n\n');
      var res = parseText(text);
      if (tcodes.length) res.codes = dedupe(tcodes);
      else res.codes.forEach(function(c){ c.module = c.module || ''; });
      res.pages = pages.length;
      return res;
    });
  }

  /* ---------- Gesamtbild: was zuerst prüfen ---------- */
  function insights(codes){
    var out = [], c = codes || [];
    function has(re, d){ return c.filter(function(x){ return re.test(x.code) || (d && d.test(x.desc||'')); }); }
    var batt = has(/^(P00FD|P0562|P0563|P0A\w+|P1A\w+|P0620|P0621|P0622|P0A0D)$/, /(batterie|batterie\s*'?b'?\s*state|ladezustand|charge|voltage|spannung(?!sschluss))/i)
      .filter(function(x){ return !/RKE|Sender|Schl[üu]ssel|remote|fernbedien/i.test(x.desc||''); });
    var net = c.filter(function(x){ return /^U/.test(x.code); });
    if (batt.length || net.length){
      var which = batt.concat(net).map(function(x){ return x.code; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ');
      out.push({
        t:['Zuerst die Spannungsversorgung','Сначала питание'],
        de:'Auffällig: '+which+'. Spannungsprobleme und Kommunikationsfehler (U-Codes) lösen viele Folgefehler aus. Reihenfolge: Batterie prüfen (Ruhespannung, unter Last, Ladezustand, Test), Ladespannung der Lichtmaschine, Masse- und Plusanschlüsse. Danach alle Codes löschen, Probefahrt, erneut lesen. Nur Codes, die zurückkommen, weiter verfolgen.',
        ru:'Обрати внимание: '+which+'. Проблемы с напряжением и ошибки связи (U-коды) вызывают много сопутствующих ошибок. Порядок: проверить АКБ (покой, под нагрузкой, заряд, тест), напряжение зарядки генератора, массы и плюсовые клеммы. Потом стереть все коды, проехать, прочитать снова. Дальше разбирать только те, что вернулись.',
        codes:batt.concat(net).map(function(x){ return x.code; })
      });
    }
    var ecu = c.filter(function(x){ return /^P0(60[0-9A-F]|61[0-9A-F])$/.test(x.code) || /ECU\s*intern|Steuerger[äa]t\s*intern|internal\s*control/i.test(x.desc||''); });
    if (ecu.length) out.push({
      t:['Steuergerät intern','Блок управления: внутренняя ошибка'],
      de:ecu.map(function(x){return x.code;}).join(', ')+': Erst Versorgung und Massen am Steuergerät prüfen (siehe oben), Softwarestand prüfen und Updates ansehen. Steuergerät erst tauschen oder programmieren, wenn der Fehler nach dem Löschen sofort wiederkommt.',
      ru:ecu.map(function(x){return x.code;}).join(', ')+': сначала питание и массы блока (см. выше), версия ПО и обновления. Менять или прошивать блок — только если ошибка сразу возвращается после стирания.',
      codes:ecu.map(function(x){ return x.code; })
    });
    // gleiche Fehlerart an mehreren Stellen
    var byF = {};
    c.forEach(function(x){ if (x.ftb && /^(11|12|13|14|15)$/.test(x.ftb)) (byF[x.ftb] = byF[x.ftb] || []).push(x); });
    Object.keys(byF).forEach(function(f){
      if (byF[f].length < 2) return;
      var i = ftbInfo(f), cs = byF[f].map(function(x){ return x.code; });
      out.push({
        t:['Gleiche Fehlerart an mehreren Stellen','Одинаковый тип ошибки в нескольких местах'],
        de:cs.join(', ')+' haben dieselbe Fehlerart ('+i.de+'). Gemeinsame Ursache wahrscheinlicher als mehrere defekte Bauteile: gemeinsame Masse, Versorgung, Steckverbinder oder Kabelbaum-Übergang (Tür, Heckklappe) und das zuständige Modul prüfen.',
        ru:cs.join(', ')+' имеют один тип ('+i.ru+'). Общая причина вероятнее, чем несколько неисправных деталей: общая масса, питание, разъём или переход жгута (дверь, багажник) и сам модуль.',
        codes:cs
      });
    });
    var tpms = has(/^C0(07[0-9A-F]|0[2-3]\w)$/, /reifendruck|tire\s*pressure|давлени.*шин/i).filter(function(x){ return /reifendruck|tire|шин/i.test(x.desc||'') || /^C0077$/.test(x.code); });
    if (tpms.length) out.push({
      t:['Reifendruck','Давление в шинах'],
      de:tpms.map(function(x){return x.code;}).join(', ')+': Reifendruck aller Räder messen und einstellen, dann Reifendruck-Kontrolle zurücksetzen oder anlernen. Kommt der Code zurück: Radsensoren (Batterie, Signal) prüfen.',
      ru:tpms.map(function(x){return x.code;}).join(', ')+': измерить и выставить давление во всех колёсах, затем сбросить или обучить TPMS. Если код вернулся: проверить датчики в колёсах (батарея, сигнал).',
      codes:tpms.map(function(x){ return x.code; })
    });
    var rke = c.filter(function(x){ return /RKE|Fernbedien|Schl[üu]sselbatterie|key\s*fob|remote/i.test(x.desc||'') && /(schwach|low|niedrig|слаб)/i.test(x.desc||''); });
    if (rke.length) out.push({
      t:['Schlüsselbatterie','Батарея ключа'],
      de:rke.map(function(x){return x.code;}).join(', ')+': Batterie im Schlüssel schwach. Einfachster Fall: Knopfzelle wechseln, danach Code löschen.',
      ru:rke.map(function(x){return x.code;}).join(', ')+': слабая батарейка в ключе. Простейший случай: заменить батарейку и стереть код.',
      codes:rke.map(function(x){ return x.code; })
    });
    return out;
  }

  window.JCREP = {parseText:parseText, fromPdf:fromPdf, parseHeader:parseHeader, ftbInfo:ftbInfo, insights:insights, statusOf:statusOf};
})();
