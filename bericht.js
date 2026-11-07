/* JC Diagnose: Import von Berichten anderer Diagnosegeräte (Launch X431, Autel, Bosch, Foxwell, Thinkdiag u. a.)
   Liest Fahrzeugdaten und Fehlercodes aus PDF, Text, CSV, HTML. Ergebnis -> window.JCREP */
(function(){
  var CODE_RE = /(^|[^A-Za-z0-9])([PBCU][0-3][0-9A-F]{3})(?:\s?[-–\/]\s?([0-9A-F]{2}))?(?![A-Za-z0-9])/g;
  var ST = [
    ['active', /\b(aktiv|akt[il1]v|aktuell|active|current|present|jetzt|vorhanden|ist\s+aktiv)\b|активн|текущ/i],
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
    if (!pdfReady) pdfReady = loadScript('pdf.min.js?v=0141').then(function(){ window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js?v=0141'; return window.pdfjsLib; });
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
  function tableFromPage(items, cols, fromY, tol){
    tol = tol || 3;
    var body = items.filter(function(i){ return i.y > fromY + tol*0.7; });
    var c1 = body.filter(function(i){ return i.x < cols.c2 - 4; });
    var c2 = body.filter(function(i){ return i.x >= cols.c2 - 4 && i.x < cols.c3 - 4; });
    var c3 = body.filter(function(i){ return i.x >= cols.c3 - 4; });
    var codeRows = groupLines(c1, tol), codes = [];
    codeRows.forEach(function(r){
      CODE_RE.lastIndex = 0; var m = CODE_RE.exec(r.text);
      if (m) codes.push({code:m[2].toUpperCase(), ftb:(m[3]||'').toUpperCase().replace(/^00$/,''), y:r.y});
    });
    if (!codes.length) return [];
    var stRows = groupLines(c3, tol).filter(function(r){ return statusOf(r.text); });
    var lines = groupLines(c2, tol);
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
        pages.push(tc.items.filter(function(i){ return i.str && i.str.trim(); }).map(function(i){ return {s:i.str.trim(), x:i.transform[4], y:-i.transform[5], h:i.height || 8}; }));
      }); }); })(n);
      return p.then(function(){ return pages; });
    }).then(function(pages){
      var res = processPages(pages, false);
      res.pages = pages.length;
      return res;
    });
  }
  /* pages: Array von Seiten, jede Seite Array aus {s, x, y, h} (Text mit Koordinaten) */
  function processPages(pages, fix){
    var fullText = [], tcodes = [], cols = null;
    pages.forEach(function(items0){
      var items = fix ? items0.map(function(i){ return {s:fixOcr(i.s), x:i.x, y:i.y, h:i.h}; }) : items0;
      var hs = items.map(function(i){ return i.h || 8; }).sort(function(a,b){ return a-b; });
      var tol = Math.max(2, 0.4 * (hs[Math.floor(hs.length/2)] || 8));
      var rows = groupLines(items, tol);
      fullText.push(rows.map(function(r){ return r.text; }).join('\n'));
      var hdr = rows.find(function(r){
        var t = r.text; return /(Beschreibung|Description|Описание)/i.test(t) && /(Zustand|Status|Состояние)/i.test(t);
      });
      var pageCols = null, hy = null;
      if (hdr){
        var near = items.filter(function(i){ return Math.abs(i.y - hdr.y) < tol*4.5; });
        var f2 = near.find(function(i){ return /(Beschreibung|Description|Описание)/i.test(i.s); });
        var f3 = near.find(function(i){ return /(Zustand|Status|Состояние)/i.test(i.s); });
        if (f2 && f3){ pageCols = {c2:f2.x, c3:f3.x}; hy = Math.max.apply(null, near.map(function(i){ return i.y; })); cols = pageCols; }
      } else if (cols) { pageCols = cols; hy = null; }
      if (pageCols){
        var pre = hy !== null ? rows.filter(function(r){ return r.y < hy; }).map(function(r){ return r.text; }).join(' ') : '';
        var mod = modulOf(pre);
        tableFromPage(items, pageCols, hy === null ? -1e9 : hy, tol).forEach(function(c){ c.module = mod; tcodes.push(c); });
      }
    });
    var text = fullText.join('\n\n');
    var res = parseText(text);
    if (tcodes.length) res.codes = dedupe(tcodes);
    else res.codes.forEach(function(c){ c.module = c.module || ''; });
    res.text = text; res.table = tcodes.length > 0;
    return res;
  }

  /* ---------- OCR (Fotos und gescannte PDFs), komplett offline ---------- */
  var DIGIT_FIX = {O:'0', I:'1', l:'1', S:'5', Z:'2', Q:'0'};
  function fixChars(str){ return str.split('').map(function(ch){ return DIGIT_FIX[ch] || ch; }).join('').toUpperCase(); }
  function fixOcr(text){
    return String(text||'').replace(/(^|[^A-Za-z0-9])([PBCUpbcu][0-3OIl][0-9A-FOIlSZQ]{3})(?:\s?[-–]\s?([0-9A-FOIlSZQ]{2}))?(?![A-Za-z0-9])/g, function(all, pre, code, ftb){
      return pre + code[0].toUpperCase() + fixChars(code.slice(1)) + (ftb ? '-' + fixChars(ftb) : '');
    });
  }
  function toCanvas(src){
    if (src && src.getContext) return Promise.resolve(src);
    return createImageBitmap(src, {imageOrientation:'from-image'}).catch(function(){ return createImageBitmap(src); }).then(function(bm){
      var c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); return c;
    });
  }
  function prep(c){
    var w = c.width, h = c.height, longSide = Math.max(w, h), k = 1;
    if (longSide > 2800) k = 2800/longSide; else if (longSide < 1800) k = Math.min(2.5, 1800/longSide);
    var o = document.createElement('canvas'); o.width = Math.round(w*k); o.height = Math.round(h*k);
    var x = o.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,o.width,o.height); x.drawImage(c, 0, 0, o.width, o.height);
    var d = x.getImageData(0, 0, o.width, o.height), a = d.data, n = a.length/4, g = new Uint8Array(n), hist = new Array(256).fill(0), i;
    for (i=0;i<n;i++){ var v = Math.round(0.299*a[i*4] + 0.587*a[i*4+1] + 0.114*a[i*4+2]); g[i] = v; hist[v]++; }
    var lo = 0, hi = 255, acc = 0;
    for (i=0;i<256;i++){ acc += hist[i]; if (acc > n*0.02){ lo = i; break; } }
    acc = 0; for (i=255;i>=0;i--){ acc += hist[i]; if (acc > n*0.02){ hi = i; break; } }
    if (hi - lo < 40){ lo = 0; hi = 255; }
    // Heller Text auf dunklem Grund (Bildschirm): umkehren
    var mean = 0; for (i=0;i<n;i+=7) mean += g[i]; mean /= Math.ceil(n/7);
    var inv = mean < 110;
    for (i=0;i<n;i++){ var t = (g[i]-lo)*255/(hi-lo); t = t<0?0:t>255?255:t; if (inv) t = 255-t; a[i*4] = a[i*4+1] = a[i*4+2] = t; a[i*4+3] = 255; }
    x.putImageData(d, 0, 0);
    return deskew(o);
  }

  /* Schiefe Fotos geradeziehen (Projektionsprofil, -8..8 Grad) */
  function deskew(c){
    var k = Math.min(1, 700/c.width), sw = Math.max(1, Math.round(c.width*k)), sh = Math.max(1, Math.round(c.height*k));
    var t = document.createElement('canvas'); t.width = sw; t.height = sh;
    var tx = t.getContext('2d'); tx.drawImage(c, 0, 0, sw, sh);
    var a = tx.getImageData(0, 0, sw, sh).data, pts = [], i, x, y;
    for (y=0;y<sh;y++) for (x=0;x<sw;x++) if (a[(y*sw+x)*4] < 110) pts.push(x, y);
    if (pts.length < 400) return c;
    function score(deg){
      var r = deg*Math.PI/180, sn = Math.sin(r), cs = Math.cos(r), bins = new Float32Array(sh + sw + 4), off = sw/2 + 2;
      for (var j=0;j<pts.length;j+=2){ var yy = Math.round(pts[j+1]*cs - pts[j]*sn + off); bins[yy]++; }
      var sc = 0; for (var q=0;q<bins.length;q++) sc += bins[q]*bins[q]; return sc;
    }
    var best = 0, bs = score(0), d;
    for (d=-8; d<=8; d+=0.5){ var v = score(d); if (v > bs*1.0005){ bs = v; best = d; } }
    var b2 = best;
    for (d=best-0.5; d<=best+0.5; d+=0.1){ var v2 = score(d); if (v2 > bs){ bs = v2; b2 = d; } }
    c.__skew = b2; if (Math.abs(b2) < 0.4) return c;
    var r = b2*Math.PI/180, w = c.width, h = c.height;
    var nw = Math.ceil(Math.abs(w*Math.cos(r)) + Math.abs(h*Math.sin(r))), nh = Math.ceil(Math.abs(w*Math.sin(r)) + Math.abs(h*Math.cos(r)));
    var o = document.createElement('canvas'); o.width = nw; o.height = nh;
    var ox = o.getContext('2d'); ox.fillStyle = '#fff'; ox.fillRect(0, 0, nw, nh);
    ox.translate(nw/2, nh/2); ox.rotate(r); ox.drawImage(c, -w/2, -h/2);
    return o;
  }
  var tessReady = null;
  function loadTess(){
    if (window.Tesseract) return Promise.resolve();
    if (!tessReady) tessReady = loadScript('ocr/tesseract.min.js?v=0141');
    return tessReady;
  }
  /* sources: Array aus Blob oder Canvas; lang z. B. 'deu+eng' */
  function ocrImages(sources, lang, onProgress){
    var texts = [], worker = null, total = sources.length;
    return loadTess().then(function(){
      return window.Tesseract.createWorker(lang || 'deu+eng', 1, {
        workerPath:'ocr/worker.min.js', corePath:'ocr/', langPath:'ocr/lang', gzip:true, workerBlobURL:false,
        logger:function(m){ if (onProgress && m && typeof m.progress === 'number') onProgress(m.status, m.progress, texts.length, total); }
      });
    }).then(function(w){
      worker = w; var p = Promise.resolve();
      sources.forEach(function(src){ p = p.then(function(){ return toCanvas(src); }).then(function(c){ return worker.recognize(prep(c), {}, {text:true, blocks:true}); }).then(function(r){ texts.push(pageFromOcr(r.data)); }); });
      return p;
    }).then(function(){ return worker.terminate(); }, function(e){ if (worker) worker.terminate(); throw e; }).then(function(){ return texts; });
  }
  /* Neigung aus den von Tesseract erkannten Zeilen schaetzen (Median der Regressionssteigung) */
  function ocrSkew(d){
    var lines = d.lines || [], sl = [];
    if (!lines.length && d.blocks) d.blocks.forEach(function(b){ (b.paragraphs||[]).forEach(function(pg){ (pg.lines||[]).forEach(function(l){ lines.push(l); }); }); });
    lines.forEach(function(l){
      var ws = (l.words || []).filter(function(w){ return w.bbox && w.text && w.text.trim(); });
      if (ws.length < 4) return;
      var n = ws.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
      ws.forEach(function(w){ var x = (w.bbox.x0+w.bbox.x1)/2, y = (w.bbox.y0+w.bbox.y1)/2; sx += x; sy += y; sxx += x*x; sxy += x*y; });
      var den = n*sxx - sx*sx; if (den < 1) return;
      sl.push((n*sxy - sx*sy)/den);
    });
    if (sl.length < 3) return 0;
    sl.sort(function(a,b){ return a-b; });
    var m = sl[Math.floor(sl.length/2)], ang = Math.atan(m);
    return Math.abs(ang) < 0.006 || Math.abs(ang) > 0.2 ? 0 : ang;
  }
  function pageFromOcr(d){
    var words = d.words;
    if (!words && d.blocks) { words = []; d.blocks.forEach(function(b){ (b.paragraphs||[]).forEach(function(pg){ (pg.lines||[]).forEach(function(l){ (l.words||[]).forEach(function(w){ words.push(w); }); }); }); }); }
    var ang = ocrSkew(d), co = Math.cos(-ang), si = Math.sin(-ang);
    var items = (words || []).filter(function(w){ return w.text && w.text.trim() && w.bbox; }).map(function(w){
      var x = w.bbox.x0, y = (w.bbox.y0+w.bbox.y1)/2;
      return {s:w.text.trim(), x:x*co - y*si, y:x*si + y*co, h:w.bbox.y1-w.bbox.y0};
    });
    return {items:items, text:d.text || '', skew:ang};
  }
  function fromImages(sources, lang, onProgress){
    return ocrImages(sources, lang, onProgress).then(function(pages){
      var withItems = pages.filter(function(pg){ return pg.items.length; });
      var res;
      if (withItems.length){ res = processPages(withItems.map(function(pg){ return pg.items; }), true); }
      else { var tx = fixOcr(pages.map(function(pg){ return pg.text; }).join('\n\n')); res = parseText(tx); res.text = tx; }
      // Falls die Tabellenerkennung nichts fand, den reinen Text von Tesseract versuchen
      if (!res.codes.length){ var tx2 = fixOcr(pages.map(function(pg){ return pg.text; }).join('\n\n')); var r2 = parseText(tx2); if (r2.codes.length){ r2.text = tx2; res = r2; } }
      res.ocr = true; return res;
    });
  }
  function pdfCanvases(buf, maxPages){
    return loadPdfJs().then(function(lib){ return lib.getDocument({data:new Uint8Array(buf)}).promise; }).then(function(pdf){
      var n = Math.min(pdf.numPages, maxPages || 6), out = [], p = Promise.resolve();
      for (var i=1;i<=n;i++) (function(i){ p = p.then(function(){ return pdf.getPage(i); }).then(function(pg){
        var vp = pg.getViewport({scale:2.4}), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        return pg.render({canvasContext:c.getContext('2d'), viewport:vp}).promise.then(function(){ out.push(c); });
      }); })(i);
      return p.then(function(){ return out; });
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

  window.JCREP = {prep:prep, ocrImages:ocrImages, parseText:parseText, fromPdf:fromPdf, fromImages:fromImages, pdfCanvases:pdfCanvases, fixOcr:fixOcr, parseHeader:parseHeader, ftbInfo:ftbInfo, insights:insights, statusOf:statusOf};
})();
