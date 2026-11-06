/* JC Diagnose – Web-Prototyp v0.1
   Daten: Kfz-Diagnose Nachschlagewerk v9.3 (window.KFZ) + Kfz_Diagnosedatenbank V3.3 (window.XLS)
   Sprache DE/RU, Soll/Ist-Messprotokoll (lokal oder per Artifact-db synchronisiert). */
(function(){
'use strict';
var D = window.KFZ, X = window.XLS;
var $ = function(s,r){ return (r||document).querySelector(s); };
var main = $('#main'), side = $('#sidebar');

/* ---------- storage (local) ---------- */
var LS = (function(){ try { var s = window['local'+'Storage']; s.setItem('jc-t','1'); s.removeItem('jc-t'); return s; } catch(e){ return null; } })();
function lget(k, d){ if (!LS) return d; try { var v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }
function lset(k, v){ if (!LS) return; try { LS.setItem(k, JSON.stringify(v)); } catch(e){} }

var state = {
  lang: lget('jc-lang', 'de'), theme: lget('jc-theme', 'dark'),
  fav: lget('jc-fav', []), mess: lget('jc-mess', []),
  q: '', sys: '', draft: null, synced: false
};
var SKINS = [
  {id:'std-dark', de:'Standard dunkel', ru:'Стандарт тёмный', theme:'dark', dot:'#f2b705'},
  {id:'std-light', de:'Standard hell', ru:'Стандарт светлый', theme:'light', dot:'#9a6a00'},
  {id:'instrument', de:'Messgerät', ru:'Прибор', theme:'dark', dot:'#39ff88'},
  {id:'clean', de:'Hell & klar', ru:'Светлый', theme:'light', dot:'#1d47c7'},
  {id:'field', de:'Pannenhilfe (groß)', ru:'Выезд (крупно)', theme:'dark', dot:'#ffd400'},
  {id:'workshop', de:'Werkstatt (Tablet)', ru:'Мастерская (планшет)', theme:'light', dot:'#e8590c'}
];
state.skin = lget('jc-skin', state.theme==='light' ? 'std-light' : 'std-dark');
function applySkin(){
  var sk = SKINS.find(function(x){ return x.id===state.skin; }) || SKINS[0];
  state.theme = sk.theme;
  document.documentElement.setAttribute('data-theme', sk.theme);
  document.documentElement.setAttribute('data-skin', sk.id);
}
applySkin();

/* ---------- i18n ---------- */
function T(de, ru){ return state.lang === 'ru' ? ru : de; }
function L(o, k){ return state.lang === 'ru' && o[k+'_ru'] ? o[k+'_ru'] : o[k]; }

var byId = {}; D.items.forEach(function(it){ byId[it.id] = it; });
var catById = {}; D.cats.forEach(function(c){ catById[c.id] = c; });
var CATCOL = {sensoren:'var(--color-info)', aktoren:'var(--color-primary)', bordnetz:'var(--color-ok)', hv:'var(--color-hv)', grundlagen:'var(--color-muted)'};

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
function strip(s){ return String(s||'').replace(/<[^>]+>/g,'').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&'); }
function norm(s){ return String(s).toLowerCase().replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/ё/g,'е'); }
function count(cat){ return D.items.filter(function(i){return i.cat===cat;}).length; }
function toast(msg){ var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function(){ t.hidden = true; }, 2600); }

/* ---------- Sollwert-Herkunft (DiagLab) ---------- */
var PROV = [['bestätigt (Schaltplan/OEM)','подтверждено (схема/OEM)'],['typisch für den Typ','типовое для типа'],['bestätigt vom Meister','подтверждено мастером'],['nicht bestimmt','не определено']];
function prov(i){ i = +i || 0; if (i<0||i>3) i = 3; return '<span class="tag t'+i+'">'+esc(T(PROV[i][0],PROV[i][1]))+'</span>'; }

/* ---------- Sollwert-Parser ---------- */
var UNITS = ['MΩ','kΩ','mΩ','Ω','kHz','Hz','mV','V','mA','µA','A','ms','µs','°C','kPa','bar','%','mH','W','min⁻¹','1/min'];
function pnum(s){ return parseFloat(String(s).replace(/\s/g,'').replace(',','.')); }
function parseSoll(txt){
  var s = strip(txt).replace(/Ohm/g,'Ω'), u = '';
  var ure = '(' + UNITS.map(function(x){return x.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&');}).join('|') + ')';
  var m = s.match(new RegExp('(-?\\d+(?:[.,]\\d+)?)\\s*('+UNITS.join('|').replace(/\//g,'\\/')+')?\\s*(?:–|-|bis|до|…|\\.\\.\\.)\\s*(-?\\d+(?:[.,]\\d+)?)\\s*'+ure));
  if (m) return {lo:pnum(m[1]), hi:pnum(m[3]), unit:m[4]};
  m = s.match(new RegExp('(<|≤|unter|max\\.?)\\s*(\\d+(?:[.,]\\d+)?)\\s*'+ure));
  if (m) return {lo:null, hi:pnum(m[2]), unit:m[3]};
  m = s.match(new RegExp('(>|≥|über|min\\.?)\\s*(\\d+(?:[.,]\\d+)?)\\s*'+ure));
  if (m) return {lo:pnum(m[2]), hi:null, unit:m[3]};
  m = s.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*'+ure));
  return {lo:null, hi:null, unit: m ? m[2] : u};
}
function judge(m){
  var v = pnum(m.ist), lo = m.lo===''||m.lo==null ? NaN : pnum(m.lo), hi = m.hi===''||m.hi==null ? NaN : pnum(m.hi);
  if (isNaN(v)) return {c:'na', t:T('kein Istwert','нет замера')};
  if (isNaN(lo) && isNaN(hi)) return {c:'na', t:T('ohne Sollwert','без нормы')};
  if (!isNaN(lo) && v < lo) return {c:'lo', t:T('zu niedrig','ниже нормы')};
  if (!isNaN(hi) && v > hi) return {c:'hi', t:T('zu hoch','выше нормы')};
  return {c:'ok', t:T('im Soll','в норме')};
}
function fmtN(x){ if (x===''||x==null||isNaN(pnum(x))) return '–'; return String(x).replace('.',','); }

/* ---------- Fotos & Screenshots (IndexedDB lokal, Artifact-Assets in der Cloud) ---------- */
var PH = (function(){
  var dbp = null, urls = {}, assets = null;
  function idb(){
    if (dbp) return dbp;
    dbp = new Promise(function(res){
      try { var rq = indexedDB.open('jc-photos', 1);
        rq.onupgradeneeded = function(){ rq.result.createObjectStore('p'); };
        rq.onsuccess = function(){ res(rq.result); }; rq.onerror = function(){ res(null); };
      } catch(e){ res(null); }
    });
    return dbp;
  }
  function tx(mode, fn){ return idb().then(function(db){ if (!db) return null; return new Promise(function(res){ try { var t = db.transaction('p', mode), st = t.objectStore('p'), r = fn(st); t.oncomplete = function(){ res(r && r.result !== undefined ? r.result : true); }; t.onerror = function(){ res(null); }; } catch(e){ res(null); } }); }); }
  if (window.claude && typeof window.claude.use === 'function') window.claude.use('assets').then(function(a){ assets = a; }, function(){});
  function compress(file){
    return new Promise(function(res, rej){
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function(){
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max/Math.max(w,h));
        var c = document.createElement('canvas'); c.width = Math.round(w*k); c.height = Math.round(h*k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function(b){ b ? res({blob:b, w:c.width, h:c.height}) : rej(new Error('toBlob')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function(){ URL.revokeObjectURL(u); rej(new Error(T('Bild nicht lesbar','Изображение не читается'))); };
      img.src = u;
    });
  }
  return {
    add: function(file){
      return compress(file).then(function(c){
        var p = {id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), w:c.w, h:c.h, kb:Math.round(c.blob.size/1024), at:new Date().toISOString(), cap:''};
        return tx('readwrite', function(st){ return st.put(c.blob, p.id); }).then(function(ok){
          urls[p.id] = URL.createObjectURL(c.blob);
          if (!ok) p.data = null;
          if (!assets) return p;
          return assets.upload(c.blob, {type:'image/jpeg'}).then(function(r){ p.asset = r.id; return p; }, function(){ return p; });
        });
      });
    },
    url: function(p){
      if (urls[p.id]) return Promise.resolve(urls[p.id]);
      return tx('readonly', function(st){ return st.get(p.id); }).then(function(b){
        if (b && b instanceof Blob) { urls[p.id] = URL.createObjectURL(b); return urls[p.id]; }
        if (p.asset) return '/_blob/' + p.asset;
        return null;
      });
    },
    del: function(p){ if (urls[p.id]) { URL.revokeObjectURL(urls[p.id]); delete urls[p.id]; } tx('readwrite', function(st){ return st.delete(p.id); }); if (p.asset && assets) assets.delete(p.asset).catch(function(){}); },
    toData: function(p){ return this.url(p).then(function(u){ if (!u) return null; return fetch(u).then(function(r){ return r.blob(); }).then(function(b){ return new Promise(function(res){ var fr = new FileReader(); fr.onload = function(){ res(fr.result); }; fr.onerror = function(){ res(null); }; fr.readAsDataURL(b); }); }, function(){ return null; }); }); },
    fromData: function(p, dataUrl){ return fetch(dataUrl).then(function(r){ return r.blob(); }).then(function(b){ return tx('readwrite', function(st){ return st.put(b, p.id); }); }); }
  };
})();
function photoThumbs(list, editable){
  if (!list || !list.length) return '';
  return '<div class="ph-grid">'+list.map(function(p,i){ return '<figure class="ph"><button type="button" class="ph-img" data-ph="'+esc(p.id)+'" aria-label="'+T('Foto öffnen','Открыть фото')+'"><span class="ph-load">…</span></button>'+
    (editable ? '<input class="ph-cap" data-cap="'+i+'" value="'+esc(p.cap||'')+'" placeholder="'+T('Beschriftung, z. B. CH A Leerlauf','Подпись, напр. CH A холостой')+'"><button type="button" class="btn small danger" data-phdel="'+i+'">'+T('Entfernen','Убрать')+'</button>' : (p.cap ? '<figcaption>'+esc(p.cap)+'</figcaption>' : ''))+'</figure>'; }).join('')+'</div>';
}
function fillThumbs(root, list){
  (list||[]).forEach(function(p){
    var b = root.querySelector('[data-ph="'+p.id+'"]'); if (!b) return;
    PH.url(p).then(function(u){
      if (!u) { b.innerHTML = '<span class="ph-load">'+T('nur auf anderem Gerät','только на другом устройстве')+'</span>'; return; }
      b.innerHTML = '<img src="'+esc(u)+'" alt="'+esc(p.cap||T('Foto','Фото'))+'" loading="lazy">';
      b.onclick = function(){ lightbox(u, p.cap); };
    });
  });
}
function lightbox(u, cap){
  var o = document.createElement('div'); o.className = 'lb'; o.innerHTML = '<img src="'+esc(u)+'" alt=""><div class="lb-bar">'+esc(cap||'')+' <button class="btn small">'+T('Schließen','Закрыть')+'</button></div>';
  o.onclick = function(){ o.remove(); }; document.body.appendChild(o);
  var k = function(e){ if (e.key==='Escape'){ o.remove(); document.removeEventListener('keydown', k); } }; document.addEventListener('keydown', k);
}

/* ---------- Messprotokoll: Speicher ---------- */
var cloud = null; // {col}
function saveLocal(){ lset('jc-mess', state.mess); }
function messPut(m){
  m.updated = new Date().toISOString();
  var i = state.mess.findIndex(function(x){return x.id===m.id;});
  if (i>=0) state.mess[i] = m; else state.mess.unshift(m);
  saveLocal();
  if (cloud) cloud.col.doc(m.id).set(JSON.parse(JSON.stringify(m))).catch(function(e){ toast(T('Cloud-Speichern fehlgeschlagen: ','Ошибка сохранения в облако: ')+(e&&e.code||'')); });
}
function messDel(id){
  var mm = state.mess.find(function(x){return x.id===id;}); if (mm && mm.photos) mm.photos.forEach(function(p){ PH.del(p); });
  state.mess = state.mess.filter(function(x){return x.id!==id;}); saveLocal();
  if (cloud) cloud.col.doc(id).delete().catch(function(){});
}
function newId(){ return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

/* Artifact-db (nur wenn als veröffentlichte Seite geöffnet) */
(function initCloud(){
  if (!window.claude || typeof window.claude.use !== 'function') return;
  Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function(r){
    var db = r[0], user = r[1]; if (!db || !user) return;
    return user.id().then(function(uid){
      if (!uid) return;
      var arch = db.doc('data/users/'+uid+'/journal').collection('berichte'); cloudArch = arch;
      arch.get().then(function(snap){ var remote = snap.docs.map(function(d){ return d.data(); }).filter(Boolean), ids = {};
        remote.forEach(function(r){ ids[r.id] = 1; });
        state.archiv.forEach(function(r){ if (!ids[r.id]) arch.doc(r.id).set(JSON.parse(JSON.stringify(r))).catch(function(){}); });
        var have = {}; state.archiv.forEach(function(r){ have[r.id] = 1; }); remote.forEach(function(r){ if (!have[r.id]) state.archiv.push(r); });
        archivSave(); if (cur()==='berichte') render(true); }, function(){ cloudArch = null; });
      var col = db.doc('data/users/'+uid+'/journal').collection('mess');
      cloud = {col: col};
      var first = true;
      col.onSnapshot(function(snap){
        var remote = snap.docs.map(function(d){ return d.data(); }).filter(Boolean);
        if (first && !snap.metadata.fromCache){
          first = false;
          // lokale Einträge, die noch nicht in der Cloud sind, einmalig hochladen
          var ids = {}; remote.forEach(function(m){ ids[m.id] = 1; });
          state.mess.forEach(function(m){ if (!ids[m.id]) col.doc(m.id).set(JSON.parse(JSON.stringify(m))).catch(function(){}); });
          var merged = remote.slice(); state.mess.forEach(function(m){ if (!ids[m.id]) merged.push(m); });
          state.mess = merged;
        } else if (!first) {
          state.mess = remote;
        } else return;
        state.mess.sort(function(a,b){ return (b.datum||'').localeCompare(a.datum||'') || (b.updated||'').localeCompare(a.updated||''); });
        saveLocal(); state.synced = true;
        var r0 = cur(); if (r0.indexOf('mess')===0 || r0==='start') render(true);
      }, function(){ cloud = null; state.synced = false; });
    });
  }).catch(function(){});
})();

/* ---------- Sidebar ---------- */
function renderQuick(r){
  var qn = $('#quickNav'); if (!qn) return;
  var it = [['start',T('Start','Главная')],['fz',T('Fahrzeuge','Машины')],['diag',T('Diagnose','Диагностика')],['obd','OBD'],['mess',T('Messungen','Замеры')],['berichte',T('Berichte','Отчёты')],['dtc',T('Codes','Коды')],['kat-sensoren',T('Nachschlagewerk','Справочник')],['oszi',T('Oszi','Осциллограммы')],['systemtests',T('Tests','Тесты')],['rechner',T('Rechner','Калькуляторы')]];
  var act = function(k){ if (k==='start') return r==='start'||r===''; if (k==='kat-sensoren') return r.indexOf('kat-')===0 || r.indexOf('b-')===0 || r.indexOf('tab-')===0; if (k==='berichte') return r.indexOf('bericht')===0; if (k==='diag') return r==='diag'||r==='diag-bericht'; if (k==='mess') return r.indexOf('mess')===0; if (k==='fz') return r.indexOf('fz')===0; return r===k; };
  qn.innerHTML = it.map(function(x){ var on = act(x[0]); var badge = (x[0]==='diag' && state.diag) ? ' <i class="qn-dot"></i>' : (x[0]==='obd' && obd.io ? ' <i class="qn-dot ok"></i>' : ''); return '<a href="#'+x[0]+'"'+(on?' aria-current="page"':'')+'>'+esc(x[1])+badge+'</a>'; }).join('');
  var on = qn.querySelector('[aria-current]'); if (on) { var l = on.offsetLeft - 12; if (l < qn.scrollLeft || on.offsetLeft + on.offsetWidth > qn.scrollLeft + qn.clientWidth) qn.scrollLeft = Math.max(0, l); }
}
(function(){ var hd = document.querySelector('.topbar'); function sync(){ document.documentElement.style.setProperty('--topbar', hd.offsetHeight + 'px'); } if (window.ResizeObserver) new ResizeObserver(sync).observe(hd); window.addEventListener('resize', sync); setTimeout(sync, 0); })();
function renderBottom(r){
  var bn = $('#bottomNav'); if (!bn) return;
  var it = [['obd','OBD','M7 4v6M17 4v6M5 10h14v4a7 7 0 0 1-14 0zM12 21v-2'],['diag',T('Diagnose','Диагностика'),'M3 12h4l3-7 4 14 3-7h4'],['mess',T('Messungen','Замеры'),'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3'],['berichte',T('Berichte','Отчёты'),'M4 5h16v14H4zM8 9h8M8 13h5']];
  bn.innerHTML = it.map(function(x){ var on = r.indexOf(x[0])===0 || (x[0]==='berichte' && r.indexOf('bericht')===0); return '<a href="#'+x[0]+'"'+(on?' aria-current="page"':'')+'><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="'+x[2]+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>'+esc(x[1])+'</span></a>'; }).join('');
}
function renderSide(r){
  var h = '<div class="nav-group"><div class="nav-label">'+T('Übersicht','Обзор')+'</div>' +
    link('start', T('Start','Главная'), '') +
    link('fz', T('Fahrzeuge','Машины'), vehicles().length || '') +
    link('mess', T('Messprotokoll Soll/Ist','Журнал замеров'), state.mess.length || '') +
    link('obd', T('Fahrzeug verbinden (OBD)','Подключить машину (OBD)'), obd.io?'●':'') +
    link('diag', T('Geführte Diagnose','Пошаговая диагностика'), state.diag ? state.diag.codes.filter(function(x){return !x.done;}).length : '') +
    link('berichte', T('Berichte (Archiv)','Отчёты (архив)'), state.archiv.length || '') +
    link('dtc', T('Fehlercodes','Коды ошибок'), '') +
    link('import', T('Bericht importieren','Импорт отчёта'), '') +
    link('oszi', T('Oszillogramme','Осциллограммы'), Object.keys(OSZ.waves).length) +
    link('systemtests', T('Systemtests','Системные тесты'), X.systemtests.rows.length) +
    link('tab-overview', T('Tabellen','Таблицы'), '') +
    link('rechner', T('Rechner','Калькуляторы'), '') +
    link('merkliste', T('Merkliste','Избранное'), state.fav.length || '') +
    link('quellen', T('Quellen und Methode','Источники и метод'), '') + '</div>';
  h += '<div class="nav-group"><div class="nav-label">'+T('Kategorien','Категории')+'</div>';
  D.cats.forEach(function(c){ h += link('kat-'+c.id, '<i class="nav-dot" style="background:'+CATCOL[c.id]+'"></i>'+esc(L(c,'name')), count(c.id)); });
  side.innerHTML = h + '</div>';
  function link(to, label, n){
    var act = r === to || (to.indexOf('tab-')===0 && r.indexOf('tab-')===0) || (to==='mess' && r.indexOf('mess')===0) || (to==='diag' && r.indexOf('diag')===0) || (to==='berichte' && r.indexOf('bericht')===0) || (to==='fz' && r.indexOf('fz')===0);
    return '<a class="nav-link" href="#'+to+'"'+(act?' aria-current="page"':'')+'><span class="l">'+label+'</span>'+(n!==''?'<span class="count">'+n+'</span>':'')+'</a>';
  }
}

/* ---------- Bausteine ---------- */
function card(it){
  var kv = (it.ov||[]).slice(0,2).map(function(r){ return '<span>'+esc(r[0])+': '+esc(r[1].length>38?r[1].slice(0,36)+'…':r[1])+'</span>'; }).join('');
  var b = it.hv ? '<span class="badge hv">HV</span>' : (it.new ? '<span class="badge info">'+T('neu','новое')+'</span>' : '');
  return '<a class="item-card" href="#b-'+it.id+'"><div class="t"><span>'+esc(L(it,'title'))+'</span><span class="num">'+it.n+'</span></div>' +
    '<div class="sub">'+esc(L(catById[it.cat],'name'))+' '+b+'</div><div class="kv-mini">'+kv+'</div></a>';
}
function hvCallout(){ return '<div class="callout hv"><b>'+T('Hochvolt','Высокое напряжение')+'</b><p>'+T('Arbeiten an HV-Systemen nur mit Qualifikation nach DGUV Information 209-093. Spannungsfreiheit mit zweipoligem Spannungsprüfer feststellen. Messgeräte mindestens CAT III 1000 V.','Работы с ВВ-системами только при наличии допуска по DGUV Information 209-093. Отсутствие напряжения проверять двухполюсным указателем. Приборы не ниже CAT III 1000 В.')+'</p></div>'; }
function deNote(){ return state.lang==='ru' ? '<p class="note">Текст главы пока на немецком. Перевод — следующий этап.</p>' : ''; }
function foot(){ return '<footer class="foot">JC Diagnose · '+T('Prototyp','Прототип')+' 0.11.4 · '+T('Daten','Данные')+': Nachschlagewerk '+esc(D.meta.version)+' + Excel '+esc(X.meta.title.replace('Kfz_Diagnosedatenbank ',''))+' · '+T('Richtwerte ohne Gewähr, Herstellerdaten gehen vor.','Ориентировочные значения, данные производителя приоритетнее.')+' · <a href="https://github.com/jaschachochlow-stack/JC-Diagnose/releases/download/apk/JC-Diagnose.apk">'+T('Android-App (APK)','Android-приложение (APK)')+'</a> · <a href="https://github.com/jaschachochlow-stack/JC-Diagnose/releases/download/windows/JC-Diagnose-Windows.exe">'+T('Windows-App (.exe)','Windows-приложение (.exe)')+'</a></footer>'; }
function crumbs(parts){ return '<p class="eyebrow"><a href="#start">'+T('Start','Главная')+'</a>'+parts.map(function(p){ return ' / '+p; }).join('')+'</p>'; }

/* ---------- Start ---------- */
var PANNE = ['k102','k103','k29','k28','k109','k119','k111','k110','k45'];
function vHome(){
  var m = D.meta, v = m.verify;
  var h = '<div class="wrap"><section class="hero"><div><p class="eyebrow">'+T('Version 0.11.4 · Stand','Версия 0.11.4 · состояние')+' '+esc(m.stand)+'</p>' +
    '<h1>JC Diagnose</h1><p class="lead">'+T('Sollwerte, Pinbelegung, Multimeter- und Oszilloskop-Prüfschritte für Sensoren, Aktoren, Bordnetz, Bussysteme und Hochvolt – plus Systemtests und dein eigenes Soll/Ist-Messprotokoll.','Нормы, распиновка, проверки мультиметром и осциллографом для датчиков, исполнительных механизмов, бортсети, шин и ВВ — плюс системные тесты и твой собственный журнал замеров «норма/факт».')+'</p>' +
    '<div class="chips"><a class="chip" href="#mess-neu">+ '+T('Neue Messung','Новый замер')+'</a><a class="chip" href="#obd">'+T('Fahrzeug verbinden','Подключить машину')+'</a><a class="chip" href="#dtc">'+T('Fehlercode prüfen','Проверить код ошибки')+'</a><a class="chip" href="#import">'+T('Bericht importieren','Импорт отчёта')+'</a><a class="chip" href="#oszi">'+T('Oszillogramme','Осциллограммы')+'</a><a class="chip" href="#tab-oszi">'+T('Oszi-Startwerte','Настройки осциллографа')+'</a><a class="chip" href="#systemtests">'+T('Systemtests','Системные тесты')+'</a><a class="chip" href="#rechner">'+T('Rechner','Калькуляторы')+'</a><a class="chip" href="#tab-fehler">'+T('Fehlerbilder','Неисправности')+'</a></div></div>' +
    '<div class="stats"><div class="stat"><b>'+m.n_items+'</b><span>'+T('Kapitel','глав')+'</span></div><div class="stat"><b>'+X.systemtests.rows.length+'</b><span>'+T('Systemtests','системных тестов')+'</span></div><div class="stat"><b>'+state.mess.length+'</b><span>'+T('eigene Messungen','своих замеров')+'</span></div></div></section>';
  h += '<div class="callout"><b>'+T('Hinweis','Важно')+'</b><p>'+T('Alle Werte sind typische Richtwerte. Verbindlich sind Sollwerte und Schaltpläne des Fahrzeugherstellers (HaynesPro, Carmin). Pinbelegungen sind typische Beispiele.','Все значения — типовые ориентиры. Обязательны нормы и схемы производителя (HaynesPro, Carmin). Распиновки — типовые примеры.')+'</p></div>';
  h += '<h2>'+T('Pannenhilfe: schnell zur Hand','Выезд: быстрый доступ')+'</h2><div class="item-list">'+PANNE.map(function(id){ return byId[id] ? card(byId[id]) : ''; }).join('')+'</div>';
  if (state.mess.length){
    h += '<h2>'+T('Letzte Messungen','Последние замеры')+'</h2><div class="mess-list">'+state.mess.slice(0,3).map(messCard).join('')+'</div><p><a href="#mess">'+T('Alle Messungen','Все замеры')+'</a></p>';
  }
  h += '<h2>'+T('Kategorien','Категории')+'</h2><div class="cat-grid">';
  D.cats.forEach(function(c){ h += '<a class="cat-card" style="border-top:3px solid '+CATCOL[c.id]+'" href="#kat-'+c.id+'"><div class="top"><b>'+esc(L(c,'name'))+'</b><span class="n">'+count(c.id)+'</span></div><p>'+esc(L(c,'desc'))+'</p></a>'; });
  after(bindMessCards);
  return h + '</div>' + foot() + '</div>';
}

/* ---------- Kategorie ---------- */
function vCat(id){
  var c = catById[id]; if (!c) return vNotFound();
  var list = D.items.filter(function(i){return i.cat===id;});
  var h = '<div class="wrap">'+crumbs([T('Kategorie','Категория')])+'<h1>'+esc(L(c,'name'))+'</h1><p class="lead">'+esc(L(c,'desc'))+' · '+list.length+' '+T('Kapitel','глав')+'</p>';
  if (id==='hv') h += hvCallout();
  h += '<div class="filterbar"><input id="catFilter" type="search" placeholder="'+T('In dieser Kategorie filtern','Фильтр по категории')+'"></div><div class="item-list" id="catList">'+list.map(card).join('')+'</div>'+foot()+'</div>';
  after(function(){ var inp = $('#catFilter'); inp.addEventListener('input', function(){ var q = norm(inp.value); $('#catList').innerHTML = list.filter(function(i){ return !q || norm(i.title+' '+i.title_ru+' '+i.text).indexOf(q)>=0; }).map(card).join('') || '<div class="empty">'+T('Kein Treffer','Ничего не найдено')+'</div>'; }); });
  return h;
}

/* ---------- Kapitel ---------- */
function vItem(id){
  var it = byId[id]; if (!it) return vNotFound();
  var idx = D.items.indexOf(it), prev = D.items[idx-1], next = D.items[idx+1];
  var fav = state.fav.indexOf(id) >= 0;
  var own = state.mess.filter(function(m){ return m.comp===id; });
  var h = '<div class="wrap">'+crumbs(['<a href="#kat-'+it.cat+'">'+esc(L(catById[it.cat],'name'))+'</a>', T('Kapitel ','Глава ')+it.n]) +
    '<div class="detail-head"><h1>'+esc(L(it,'title'))+'</h1><div class="actions"><button class="btn" id="favBtn" aria-pressed="'+fav+'">'+(fav?T('Gemerkt','В избранном'):T('Merken','В избранное'))+'</button><a class="btn primary" href="#mess-neu" data-new="'+id+'">+ '+T('Messung','Замер')+'</a></div></div>';
  if (state.lang==='ru') h += '<p class="subtitle">'+esc(it.title)+'</p>';
  if (it.hv) h += hvCallout();
  if (it.ov && it.ov.length) h += '<dl class="quick">' + it.ov.map(function(r,i){ return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd><button class="btn small mbtn" data-ov="'+i+'">→ '+T('als Soll messen','замерить по норме')+'</button></div>'; }).join('') + '</dl>';
  h += oszForItem(id);
  if (own.length) h += '<h2>'+T('Eigene Messungen','Мои замеры')+' ('+own.length+')</h2><div class="mess-list">'+own.slice(0,5).map(messCard).join('')+'</div>';
  if (it.sections.length > 1) h += '<nav class="toc">' + it.sections.map(function(s,i){ return '<a href="#b-'+id+'" data-sec="s'+i+'">'+esc(s.replace(/\(.*?\)/g,'').trim())+'</a>'; }).join('') + '</nav>';
  h += deNote() + '<article class="content">'+it.html+'</article>';
  if (it.verify){
    var v = it.verify, tot = v.confirmed+v.partial+v.missing+v.conflict || 1;
    h += '<section class="verify"><h2>'+T('Nachprüfung der Kernwerte','Проверка ключевых значений')+'</h2>' +
      '<div class="bar" role="img"><i style="width:'+(v.confirmed/tot*100)+'%;background:var(--color-ok)"></i><i style="width:'+(v.partial/tot*100)+'%;background:var(--color-info)"></i><i style="width:'+(v.missing/tot*100)+'%;background:var(--color-warn)"></i><i style="width:'+(v.conflict/tot*100)+'%;background:var(--color-hv)"></i></div>' +
      '<div class="legend"><span style="--c:var(--color-ok)">'+v.confirmed+' '+T('bestätigt','подтверждено')+'</span><span style="--c:var(--color-info)">'+v.partial+' '+T('teilweise','частично')+'</span><span style="--c:var(--color-warn)">'+v.missing+' '+T('nicht in Quelle','нет в источнике')+'</span><span style="--c:var(--color-hv)">'+v.conflict+' '+T('korrigiert','исправлено')+'</span></div></section>';
  }
  if (it.sources.length) h += '<section><h2>'+T('Quellen','Источники')+' ('+it.sources.length+')</h2><ol class="src-list">' + it.sources.map(function(s){ return '<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.name)+'</a></li>'; }).join('') + '</ol></section>';
  h += '<nav class="pager">' + (prev?'<a href="#b-'+prev.id+'"><small>'+T('Zurück','Назад')+'</small>'+esc(L(prev,'title'))+'</a>':'<span></span>') + (next?'<a class="next" href="#b-'+next.id+'"><small>'+T('Weiter','Далее')+'</small>'+esc(L(next,'title'))+'</a>':'') + '</nav>' + foot() + '</div>';
  after(function(){
    var fb = $('#favBtn'); fb.onclick = function(){ var i = state.fav.indexOf(id); if (i>=0) state.fav.splice(i,1); else state.fav.push(id); lset('jc-fav', state.fav); var on = state.fav.indexOf(id)>=0; fb.setAttribute('aria-pressed', on); fb.textContent = on?T('Gemerkt','В избранном'):T('Merken','В избранное'); renderSide('b-'+id); };
    main.querySelectorAll('[data-sec]').forEach(function(a){ a.onclick = function(e){ e.preventDefault(); var el = document.getElementById(a.dataset.sec); if (el) el.scrollIntoView({behavior:'smooth'}); }; });
    main.querySelectorAll('[data-ov]').forEach(function(b){ b.onclick = function(){ var r = it.ov[+b.dataset.ov], p = parseSoll(r[1]); startDraft({comp:id, punkt:r[0], solltxt:r[1], lo:p.lo, hi:p.hi, einheit:p.unit, herkunft:1}); }; });
    main.querySelectorAll('[data-new]').forEach(function(a){ a.onclick = function(e){ e.preventDefault(); startDraft({comp:a.dataset.new}); }; });
    bindWaves(id);
    bindMessCards();
  });
  return h;
}

/* ---------- Messprotokoll ---------- */
var MITTEL = [['Multimeter','Мультиметр'],['Oszilloskop','Осциллограф'],['Diagnosetester (Istwert)','Сканер (живые данные)'],['Stromzange','Токовые клещи'],['Isolationsmessgerät','Мегаомметр'],['Batterietester','Тестер АКБ'],['IR-Thermometer (Infrarot)','ИК-термометр (пирометр)'],['Wärmebildkamera','Тепловизор'],['Manometer (Druck)','Манометр'],['Vakuummeter (Unterdruck)','Вакуумметр'],['Kompressionstester','Компрессометр'],['Rauchgenerator (Lecksuche)','Дымогенератор (поиск утечек)']];
function messCard(m){
  var j = judge(m), it = byId[m.comp];
  var name = it ? L(it,'title') : (m.compFree || T('ohne Bauteil','без компонента'));
  var car = [m.kz, m.marke, m.modell].filter(Boolean).join(' ');
  return '<div class="mess"><div class="r1"><b>'+esc(name)+'</b><span class="st '+j.c+'">'+esc(j.t)+'</span></div>' +
    (m.punkt ? '<div class="meta">'+esc(m.punkt)+(m.zustand?' · '+esc(m.zustand):'')+'</div>' : '') +
    '<div class="vals">'+T('Soll','Норма')+' '+fmtN(m.lo)+' … '+fmtN(m.hi)+' '+esc(m.einheit||'')+' &nbsp;·&nbsp; '+T('Ist','Факт')+' <b>'+fmtN(m.ist)+' '+esc(m.einheit||'')+'</b> '+prov(m.herkunft)+'</div>' +
    '<div class="meta">'+esc(m.datum||'')+(car?' · '+esc(car):'')+(m.vin?' · VIN …'+esc(m.vin):'')+(m.befund?' · '+esc(m.befund):'')+'</div>' +
    (m.photos && m.photos.length ? photoThumbs(m.photos.slice(0,4), false) : '') +
    '<div class="btn-row" style="margin:4px 0 0"><a class="btn small" href="#mess-neu" data-edit="'+esc(m.id)+'">'+T('Bearbeiten','Изменить')+'</a>'+(it?'<a class="btn small" href="#b-'+it.id+'">'+T('Kapitel','Глава')+'</a>':'')+'</div></div>';
}
function bindMessCards(){
  state.mess.forEach(function(m){ if (m.photos && m.photos.length) fillThumbs(main, m.photos.slice(0,4)); });
  main.querySelectorAll('[data-edit]').forEach(function(a){ a.onclick = function(e){ e.preventDefault(); var m = state.mess.find(function(x){return x.id===a.dataset.edit;}); if (m) { state.draft = JSON.parse(JSON.stringify(m)); go('mess-neu'); } }; });
}
function startDraft(p, noNav){
  var d = {id:newId(), datum:new Date().toISOString().slice(0,10), marke:'', modell:'', vin:'', motorcode:'', comp:'', compFree:'', zustand:'', punkt:'', mittel:'Multimeter', lo:'', hi:'', einheit:'', solltxt:'', herkunft:3, ist:'', vdiv:'', tdiv:'', trigger:'', befund:'', notiz:''};
  var last = state.mess[0]; if (last){ d.kz = last.kz||''; d.marke = last.marke; d.modell = last.modell; d.vin = last.vin; d.motorcode = last.motorcode; }
  if (state.diag && state.diag.fz){ var fz = state.diag.fz; if (fz.kz||fz.marke||fz.modell||fz.vin){ d.kz = fz.kz||''; d.marke = fz.marke||''; d.modell = fz.modell||''; d.vin = fz.vin||''; } }
  Object.keys(p||{}).forEach(function(k){ if (p[k]!=null) d[k] = (typeof p[k]==='number' && k!=='herkunft') ? String(p[k]).replace('.',',') : p[k]; });
  state.draft = d; if (!noNav) go('mess-neu');
}
function vMess(){
  var list = state.mess, f = state.messF || '';
  var shown = list.filter(function(m){ if (!f) return true; var it = byId[m.comp]; return norm([m.kz,m.marke,m.modell,m.vin,m.punkt,m.befund,m.notiz,m.compFree,it?it.title+' '+it.title_ru:''].join(' ')).indexOf(norm(f))>=0; });
  var cnt = {ok:0,lo:0,hi:0,na:0}; list.forEach(function(m){ cnt[judge(m).c]++; });
  var h = '<div class="wrap">'+crumbs([T('Messprotokoll','Журнал замеров')])+'<div class="detail-head"><h1>'+T('Messprotokoll Soll/Ist','Журнал замеров «норма/факт»')+'</h1><div class="actions"><a class="btn primary" href="#mess-neu" id="newBtn">+ '+T('Neue Messung','Новый замер')+'</a></div></div>' +
    '<p class="lead">'+T('Jede Messung mit Sollwert, Herkunft des Sollwerts und automatischer Bewertung.','Каждый замер с нормой, источником нормы и автоматической оценкой.')+'</p>' +
    '<p class="sync'+(state.synced?' on':'')+'"><i></i>'+(state.synced?T('Synchronisiert (privat, nur für dich)','Синхронизировано (лично, только для тебя)'):T('Nur in diesem Browser gespeichert – Backup regelmäßig sichern','Хранится только в этом браузере — регулярно делай резервную копию'))+'</p>';
  if (list.length) h += '<div class="legend" style="margin:8px 0 16px"><span style="--c:var(--color-ok)">'+cnt.ok+' '+T('im Soll','в норме')+'</span><span style="--c:var(--color-hv)">'+(cnt.lo+cnt.hi)+' '+T('außerhalb','вне нормы')+'</span><span style="--c:var(--color-faint)">'+cnt.na+' '+T('ohne Bewertung','без оценки')+'</span></div>';
  h += '<div class="filterbar"><input id="messFilter" type="search" value="'+esc(f)+'" placeholder="'+T('Filtern: Fahrzeug, VIN, Bauteil, Befund','Фильтр: машина, VIN, компонент, вывод')+'"><span class="muted">'+shown.length+' / '+list.length+'</span></div>';
  h += list.length ? '<div class="mess-list" id="messList">'+shown.map(messCard).join('')+'</div>' :
    '<div class="empty"><p>'+T('Noch keine Messungen. Starte im Kapitel eines Bauteils mit „als Soll messen“ oder hier mit „Neue Messung“.','Замеров пока нет. Начни в главе компонента кнопкой «замерить по норме» или здесь — «Новый замер».')+'</p></div>';
  h += '<h2>'+T('Export und Backup','Экспорт и резервная копия')+'</h2><div class="btn-row"><button class="btn" id="csvCopy">'+T('CSV kopieren','Копировать CSV')+'</button><button class="btn" id="csvSave">'+T('CSV speichern','Сохранить CSV')+'</button><button class="btn" id="bakSave">'+T('Backup speichern (JSON, mit Fotos)','Сохранить копию (JSON, с фото)')+'</button><label class="btn" for="bakLoad">'+T('Backup laden','Загрузить копию')+'</label><input type="file" id="bakLoad" accept=".json,application/json" hidden></div><p class="muted" style="font-size:var(--text-xs)">'+T('CSV mit Semikolon, öffnet direkt in Excel. Spalten wie Blatt MESSPROTOKOLL der Datenbank V3.3 plus Soll/Ist.','CSV с точкой с запятой, сразу открывается в Excel. Столбцы как в листе MESSPROTOKOLL базы V3.3 плюс норма/факт.')+'</p><div id="copyArea"></div>' + foot() + '</div>';
  after(function(){
    bindMessCards();
    $('#newBtn').onclick = function(e){ e.preventDefault(); startDraft({}); };
    var fi = $('#messFilter'); fi.addEventListener('input', function(){ state.messF = fi.value; clearTimeout(fi.t); fi.t = setTimeout(function(){ render(true); var n = $('#messFilter'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    $('#csvCopy').onclick = function(){ var c = toCSV(); copyText(c); };
    $('#csvSave').onclick = function(){ saveFile('JC-Diagnose_Messprotokoll_'+today()+'.csv', '\ufeff'+toCSV(), 'text/csv'); };
    $('#bakSave').onclick = function(){ toast(T('Backup wird erstellt …','Создаю копию …')); var all = []; state.mess.forEach(function(m){ (m.photos||[]).forEach(function(p){ all.push(p); }); });
      Promise.all(all.map(function(p){ return PH.toData(p).then(function(dataUrl){ return [p.id, dataUrl]; }); })).then(function(pairs){ var photos = {}; pairs.forEach(function(x){ if (x[1]) photos[x[0]] = x[1]; });
        saveFile('JC-Diagnose_Backup_'+today()+'.json', JSON.stringify({app:'JC Diagnose', v:2, exported:new Date().toISOString(), mess:state.mess, fav:state.fav, photos:photos, archiv:state.archiv}), 'application/json'); }); };
    $('#bakLoad').onchange = function(e){ var file = e.target.files[0]; if (!file) return; var rd = new FileReader(); rd.onload = function(){ try { var o = JSON.parse(rd.result); if (!o || !Array.isArray(o.mess)) throw 0; var n = 0; o.mess.forEach(function(m){ if (m && m.id && !state.mess.some(function(x){return x.id===m.id;})) { (m.photos||[]).forEach(function(p){ if (o.photos && o.photos[p.id]) PH.fromData(p, o.photos[p.id]); }); messPut(m); n++; } }); if (Array.isArray(o.archiv)) { o.archiv.forEach(function(r){ if (r && r.id && !state.archiv.some(function(x){ return x.id===r.id; })) state.archiv.push(r); }); archivSave(); }
          if (Array.isArray(o.fav)) { o.fav.forEach(function(x){ if (byId[x] && state.fav.indexOf(x)<0) state.fav.push(x); }); lset('jc-fav', state.fav); } toast(n+' '+T('Messungen importiert','замеров загружено')); render(true); } catch(err){ toast(T('Datei nicht lesbar','Файл не читается')); } }; rd.readAsText(file); };
  });
  return h;
}
function today(){ return new Date().toISOString().slice(0,10); }
function toCSV(){
  var head = ['Datum','Kennzeichen','Marke','Modell','VIN gekürzt','Motorcode','Bauteil','Betriebszustand','Messpunkt','Messmittel','Soll min','Soll max','Einheit','Sollwert-Text','Herkunft Sollwert','Istwert','Bewertung','Scope V/div','Scope ms/div','Trigger','Befund','Notiz','Fotos'];
  var csvN = function(x){ return (x===''||x==null||isNaN(pnum(x))) ? '' : String(x).replace('.',','); };
  var rows = state.mess.map(function(m){ var it = byId[m.comp]; return [m.datum,m.kz,m.marke,m.modell,m.vin,m.motorcode,it?it.title:m.compFree,m.zustand,m.punkt,m.mittel,csvN(m.lo),csvN(m.hi),m.einheit,m.solltxt,PROV[+m.herkunft||0][0],csvN(m.ist),(function(){ var s=state.lang; state.lang='de'; var t=judge(m).t; state.lang=s; return t; })(),m.vdiv,m.tdiv,m.trigger,m.befund,m.notiz,(m.photos||[]).length]; });
  return [head].concat(rows).map(function(r){ return r.map(function(c){ c = String(c==null?'':c); return /[;"\n]/.test(c) ? '"'+c.replace(/"/g,'""')+'"' : c; }).join(';'); }).join('\r\n');
}
function copyText(txt){
  var done = function(){ toast(T('In die Zwischenablage kopiert','Скопировано в буфер обмена')); };
  var fallback = function(){ $('#copyArea').innerHTML = '<p class="muted">'+T('Kopieren nicht erlaubt – Text markieren und kopieren:','Копирование запрещено — выдели текст и скопируй:')+'</p><textarea class="copybox" readonly></textarea>'; var ta = $('#copyArea textarea'); ta.value = txt; ta.select(); };
  try { navigator.clipboard.writeText(txt).then(done, fallback); } catch(e){ fallback(); }
}
function saveFile(name, data, mime){
  var viaBlob = function(){ try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type:mime})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000); } catch(e){ copyText(data); } };
  if (window.claude && typeof window.claude.use === 'function'){
    window.claude.use('downloads').then(function(dl){ if (!dl) return viaBlob(); dl.save({filename:name, data:data}).then(function(){}, function(){ toast(T('Speichern abgebrochen','Сохранение отменено')); }); }, viaBlob);
  } else viaBlob();
}

function vMessForm(){
  if (!state.draft) startDraft({}, true);
  var d = state.draft, isEdit = state.mess.some(function(x){return x.id===d.id;});
  var opts = function(arr, val){ return arr.map(function(o){ var v = Array.isArray(o)?o[0]:o, l = Array.isArray(o)?o[1]:o; return '<option value="'+esc(v)+'"'+(String(v)===String(val)?' selected':'')+'>'+esc(l)+'</option>'; }).join(''); };
  var comps = [['',T('– frei eingeben –','– свой вариант –')]].concat(D.items.filter(function(i){return i.cat!=='grundlagen';}).map(function(i){ return [i.id, i.n+' · '+L(i,'title')]; }));
  var ZUST_RU = {'Motor aus / Sleep':'Двигатель выкл. / сон','Zündung ein, Motor aus (KOEO)':'Зажигание вкл., двигатель не работает (KOEO)','Starten':'Пуск','Leerlauf kalt':'Холостой ход, холодный','Leerlauf warm':'Холостой ход, прогретый','Teillast':'Частичная нагрузка','Volllast':'Полная нагрузка','Schub':'Принудительный холостой (накат)','Nachlauf':'Выбег после выключения','EV READY / Laden':'EV READY / зарядка'};
  var zust = [['','–']].concat(X.zustaende.rows.map(function(r){ var v = strip(r[0]); return [v, state.lang==='ru' && ZUST_RU[v] ? ZUST_RU[v] : v]; }));
  var fld = function(id, label, val, extra){ return '<div class="field'+(extra&&extra.wide?' wide':'')+'"><label for="f_'+id+'">'+label+'</label><input id="f_'+id+'" data-k="'+id+'" value="'+esc(val==null?'':val)+'"'+(extra&&extra.num?' inputmode="decimal"':'')+(extra&&extra.list?' list="'+extra.list+'"':'')+(extra&&extra.type?' type="'+extra.type+'"':'')+'></div>'; };
  var sel = function(id, label, arr, val, wide){ return '<div class="field'+(wide?' wide':'')+'"><label for="f_'+id+'">'+label+'</label><select id="f_'+id+'" data-k="'+id+'">'+opts(arr,val)+'</select></div>'; };
  var it = byId[d.comp];
  var h = '<div class="wrap">'+crumbs(['<a href="#mess">'+T('Messprotokoll','Журнал замеров')+'</a>', isEdit?T('Bearbeiten','Изменить'):T('Neue Messung','Новый замер')])+'<h1>'+(isEdit?T('Messung bearbeiten','Изменить замер'):T('Neue Messung','Новый замер'))+'</h1>' +
    '<form id="mf" autocomplete="off">' +
    '<fieldset class="fs"><legend>'+T('Fahrzeug','Автомобиль')+'</legend><div class="form-grid">' +
      fld('datum', T('Datum','Дата'), d.datum, {type:'date'}) + fld('kz', T('Kennzeichen','Госномер'), d.kz) + fld('marke', T('Marke','Марка'), d.marke, {list:'dlMarken'}) + fld('modell', T('Modell / Baujahr','Модель / год'), d.modell) + fld('vin', T('VIN (letzte 6–8 Zeichen)','VIN (последние 6–8 знаков)'), d.vin) + fld('motorcode', T('Motorcode','Код двигателя'), d.motorcode) +
    '</div></fieldset>' +
    '<fieldset class="fs"><legend>'+T('Messpunkt','Точка замера')+'</legend><div class="form-grid">' +
      sel('comp', T('Bauteil (Kapitel)','Компонент (глава)'), comps, d.comp, true) +
      '<div class="field wide" id="freeWrap"'+(d.comp?' hidden':'')+'><label for="f_compFree">'+T('Bauteil frei','Компонент вручную')+'</label><input id="f_compFree" data-k="compFree" value="'+esc(d.compFree)+'"></div>' +
      sel('zustand', T('Betriebszustand','Режим работы'), zust, d.zustand) + fld('punkt', T('Messpunkt / Pin','Точка / контакт'), d.punkt) + sel('mittel', T('Messmittel','Прибор'), MITTEL.map(function(x){return [x[0], T(x[0],x[1])];}), d.mittel) +
    '</div>' + (it && it.ov && it.ov.length ? '<p class="muted" style="font-size:var(--text-xs)">'+T('Richtwerte aus dem Kapitel übernehmen:','Взять норму из главы:')+'</p><div class="chips" id="ovChips">'+it.ov.map(function(r,i){ return '<button type="button" class="chip" data-ovi="'+i+'">'+esc(r[0])+': '+esc(r[1].length>40?r[1].slice(0,38)+'…':r[1])+'</button>'; }).join('')+'</div>' : '') + '</fieldset>' +
    '<fieldset class="fs"><legend>'+T('Soll und Ist','Норма и факт')+'</legend><div class="form-grid">' +
      fld('lo', T('Soll min','Норма мин.'), d.lo, {num:1}) + fld('hi', T('Soll max','Норма макс.'), d.hi, {num:1}) + fld('einheit', T('Einheit','Единица'), d.einheit, {list:'dlUnits'}) +
      sel('herkunft', T('Herkunft des Sollwerts','Источник нормы'), PROV.map(function(p,i){ return [i, T(p[0],p[1])]; }), d.herkunft) +
      fld('solltxt', T('Sollwert laut Quelle (Text)','Норма по источнику (текст)'), d.solltxt, {wide:1}) +
      fld('ist', T('Istwert (gemessen)','Факт (замер)'), d.ist, {num:1}) +
    '</div><div class="ist-out" id="judge" aria-live="polite"></div></fieldset>' +
    '<fieldset class="fs"><legend>'+T('Oszilloskop (optional)','Осциллограф (по желанию)')+'</legend><div class="form-grid">' +
      fld('vdiv', 'V/div', d.vdiv) + fld('tdiv', 'ms/div', d.tdiv) + fld('trigger', 'Trigger', d.trigger) +
    '</div></fieldset>' +
    '<fieldset class="fs" id="phFs"><legend>'+T('Fotos und Screenshots','Фото и скриншоты')+' ('+(d.photos||[]).length+')</legend>' +
      '<div class="ph-drop" id="phDrop"><p>'+T('Oszilloskop-Bild, Multimeter-Anzeige, Stecker, Schaltplanausschnitt …','Картинка осциллографа, показание мультиметра, разъём, кусок схемы …')+'</p><div class="btn-row" style="justify-content:center"><label class="btn primary" for="phCam">'+T('Foto aufnehmen','Сфотографировать')+'</label><label class="btn" for="phFile">'+T('Bild / Screenshot wählen','Выбрать фото / скриншот')+'</label></div><p class="meta">'+T('oder hierher ziehen, oder Screenshot mit Strg+V / ⌘+V einfügen','или перетащи сюда, или вставь скриншот Ctrl+V / ⌘+V')+'</p>' +
      '<input type="file" id="phCam" accept="image/*" capture="environment" hidden><input type="file" id="phFile" accept="image/*" multiple hidden></div><div id="phBox">'+photoThumbs(d.photos, true)+'</div></fieldset>' +
    '<fieldset class="fs"><legend>'+T('Befund','Вывод')+'</legend><div class="form-grid">' +
      fld('befund', T('Befund (kurz)','Вывод (кратко)'), d.befund, {wide:1}) +
      '<div class="field wide"><label for="f_notiz">'+T('Notiz','Заметка')+'</label><textarea id="f_notiz" data-k="notiz">'+esc(d.notiz)+'</textarea></div>' +
    '</div></fieldset>' +
    '<div class="btn-row"><button class="btn primary" type="submit">'+T('Speichern','Сохранить')+'</button><a class="btn" href="#mess" id="cancelBtn">'+T('Abbrechen','Отмена')+'</a>'+(isEdit?'<button class="btn danger" type="button" id="delBtn">'+T('Löschen','Удалить')+'</button>':'')+'</div></form>' +
    '<datalist id="dlMarken">'+X.marken.map(function(m){return '<option value="'+esc(m)+'">';}).join('')+'</datalist>' +
    '<datalist id="dlUnits">'+UNITS.map(function(u){return '<option value="'+esc(u)+'">';}).join('')+'</datalist>' + foot() + '</div>';
  after(function(){
    var form = $('#mf');
    function sync(){ form.querySelectorAll('[data-k]').forEach(function(e){ d[e.dataset.k] = e.value; }); var j = judge(d); $('#judge').innerHTML = '<span class="st '+j.c+'">'+esc(j.t)+'</span> &nbsp;'+T('Soll','Норма')+' '+fmtN(d.lo)+' … '+fmtN(d.hi)+' '+esc(d.einheit)+' · '+T('Ist','Факт')+' '+fmtN(d.ist)+' '+esc(d.einheit); }
    form.addEventListener('input', sync); form.addEventListener('change', sync); sync();
    d.photos = d.photos || []; d._added = d._added || [];
    function drawPh(){ $('#phBox').innerHTML = photoThumbs(d.photos, true); $('#phFs legend').textContent = T('Fotos und Screenshots','Фото и скриншоты')+' ('+d.photos.length+')'; fillThumbs($('#phBox'), d.photos);
      main.querySelectorAll('[data-cap]').forEach(function(e){ e.oninput = function(){ d.photos[+e.dataset.cap].cap = e.value; }; });
      main.querySelectorAll('[data-phdel]').forEach(function(b){ b.onclick = function(){ var p = d.photos.splice(+b.dataset.phdel,1)[0]; if (p && d._added.indexOf(p.id)>=0) PH.del(p); else if (p) (d._removed = d._removed||[]).push(p); drawPh(); }; }); }
    function addFiles(files){ files = Array.prototype.filter.call(files||[], function(f){ return /^image\//.test(f.type); }); if (!files.length) return;
      toast(T('Bild wird gespeichert …','Сохраняю фото …'));
      files.reduce(function(pr, f){ return pr.then(function(){ return PH.add(f).then(function(p){ d.photos.push(p); d._added.push(p.id); drawPh(); }); }); }, Promise.resolve())
        .then(function(){ toast(T('Foto hinzugefügt','Фото добавлено')); }, function(e){ toast((e&&e.message)||T('Fehler beim Bild','Ошибка с фото')); }); }
    $('#phCam').onchange = function(e){ addFiles(e.target.files); e.target.value=''; };
    $('#phFile').onchange = function(e){ addFiles(e.target.files); e.target.value=''; };
    var dz = $('#phDrop');
    dz.addEventListener('dragover', function(e){ e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', function(){ dz.classList.remove('over'); });
    dz.addEventListener('drop', function(e){ e.preventDefault(); dz.classList.remove('over'); addFiles(e.dataTransfer.files); });
    if (window._phPaste) document.removeEventListener('paste', window._phPaste);
    window._phPaste = function(e){ if (cur()!=='mess-neu') return; var it = e.clipboardData && e.clipboardData.items; if (!it) return; var fs = []; for (var i=0;i<it.length;i++){ if (it[i].kind==='file' && /^image\//.test(it[i].type)) fs.push(it[i].getAsFile()); } if (fs.length){ e.preventDefault(); addFiles(fs); } };
    document.addEventListener('paste', window._phPaste);
    drawPh();
    $('#f_comp').addEventListener('change', function(){ d.comp = this.value; render(true); });
    main.querySelectorAll('[data-ovi]').forEach(function(b){ b.onclick = function(){ var r = it.ov[+b.dataset.ovi], p = parseSoll(r[1]); d.punkt = d.punkt || r[0]; d.solltxt = r[1]; d.lo = p.lo==null?'':String(p.lo).replace('.',','); d.hi = p.hi==null?'':String(p.hi).replace('.',','); d.einheit = p.unit||d.einheit; if (+d.herkunft===3) d.herkunft = 1; render(true); }; });
    form.onsubmit = function(e){ e.preventDefault(); sync(); ['lo','hi','ist'].forEach(function(k){ d[k] = String(d[k]).trim(); }); (d._removed||[]).forEach(function(p){ PH.del(p); }); var out = JSON.parse(JSON.stringify(d)); delete out._added; delete out._removed; messPut(out); state.draft = null; toast(T('Messung gespeichert','Замер сохранён'));
      if (state.diagRet && state.diag){ var rc = state.diag.codes[state.diagRet.ci], rs = rc && rc.steps[state.diagRet.si]; if (rs){ if (rs.mess.indexOf(out.id)<0) rs.mess.push(out.id); var jj = judge(out).c; if (!rs.st && (jj==='lo'||jj==='hi')) { rs.st = 'nok'; rs.at = new Date().toISOString(); } else if (!rs.st && jj==='ok') { rs.st = 'ok'; rs.at = new Date().toISOString(); } state.diag.ci = state.diagRet.ci; rc.si = state.diagRet.si; diagSave(); } state.diagRet = null; go('diag'); return; }
      go('mess'); };
    $('#cancelBtn').onclick = function(e){ if (state.diagRet){ e.preventDefault(); state.diagRet = null; setTimeout(function(){ go('diag'); },0); } (d._added||[]).forEach(function(id){ var p = d.photos.find(function(x){return x.id===id;}); if (p) PH.del(p); }); state.draft = null; };
    var db = $('#delBtn'); if (db) db.onclick = function(){ if (db.dataset.sure){ messDel(d.id); state.draft = null; toast(T('Gelöscht','Удалено')); go('mess'); } else { db.dataset.sure = 1; db.textContent = T('Wirklich löschen?','Точно удалить?'); } };
  });
  return h;
}

/* ---------- Systemtests (Excel V3.3) ---------- */
var HEAD_RU = {
  overview:['Компонент','Тип датчика/привода','Контакты (тип.)','Сопротивление (тип.)','Напряжение сигнала (тип.)','ШИМ / частота','Предпочтительный прибор'],
  hv:['Область','Величина','Эталонное значение','Прибор','Источник'],
  oszi:['Компонент','Вольт/дел','Время/дел','Запуск'],
  fehler:['Замер','Вероятная причина'],
  systemtests:['Система','Компонент','Режим','Точка / метод','Ориентир / трактовка','Форма сигнала','Картина неисправности','Опасность','Статус источника','Примечание'],
  obd:['Интерфейс','Контакт','Назначение','Статус','Источник / норма','Важное ограничение'],
  zustaende:['Режим','Что документировать','Указание к замеру'],
  v33:['ID','Система','Компонент / метод','Автомобиль / область','Режим','Точка / подключение','Прибор / настройки','Эталон / трактовка','Единица','Неисправности / оценка','Качество источника','Ссылка','Ограничения / безопасность']
};
function heads(key, h){ return state.lang==='ru' && HEAD_RU[key] && HEAD_RU[key].length===h.length ? HEAD_RU[key] : h; }
function vSystemtests(){
  var S = X.systemtests, systems = [];
  S.rows.forEach(function(r){ if (systems.indexOf(r[0])<0) systems.push(r[0]); });
  var h = '<div class="wrap">'+crumbs([T('Systemtests','Системные тесты')])+'<h1>'+T('Systemtests','Системные тесты')+'</h1><p class="lead">'+T('51 systemweise Prüfungen aus der Kfz_Diagnosedatenbank V3.3: Betriebszustand, Messpunkt, Richtwert, Kurvenform, Fehlermuster.','51 проверка по системам из базы Kfz_Diagnosedatenbank V3.3: режим, точка замера, ориентир, форма сигнала, картина неисправности.')+'</p>' +
    '<div class="callout"><b>'+T('Status','Статус')+'</b><p>'+T('Alle Zeilen sind allgemeine Richtwerte (keine OEM-Sollwerte, keine verifizierten Pins). Exakte Zuordnung erfordert VIN, Motorcode, ECU und Schaltplan.','Все строки — общие ориентиры (не нормы OEM, распиновка не подтверждена). Для точной привязки нужны VIN, код двигателя, блок и схема.')+'</p></div>' +
    '<div class="chips sys" id="sysChips"><button class="chip" data-s="" aria-pressed="'+(!state.sys)+'">'+T('Alle','Все')+'</button>'+systems.map(function(s){ return '<button class="chip" data-s="'+esc(s)+'" aria-pressed="'+(state.sys===s)+'">'+esc(s)+'</button>'; }).join('')+'</div>' +
    '<div class="filterbar"><input id="stFilter" type="search" placeholder="'+T('Filtern, z. B. Batterie, CAN, Lambda','Фильтр, напр. АКБ, CAN, лямбда')+'"><span class="muted" id="stCount"></span></div>' +
    '<div class="tbl big"><table><thead><tr><th></th>'+heads('systemtests',S.head).map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody id="stBody"></tbody></table></div>'+foot()+'</div>';
  after(function(){
    var inp = $('#stFilter');
    function draw(){ var q = norm(inp.value); var r = S.rows.map(function(row,i){return [row,i];}).filter(function(x){ return (!state.sys || x[0][0]===state.sys) && (!q || norm(strip(x[0].join(' '))).indexOf(q)>=0); });
      $('#stBody').innerHTML = r.map(function(x){ return '<tr><td><button class="btn small" data-st="'+x[1]+'">+ '+T('Messung','Замер')+'</button></td>'+x[0].map(function(c){return '<td>'+c+'</td>';}).join('')+'</tr>'; }).join('');
      $('#stCount').textContent = r.length+' '+T('Zeilen','строк');
      main.querySelectorAll('[data-st]').forEach(function(b){ b.onclick = function(){ var row = S.rows[+b.dataset.st].map(strip), p = parseSoll(row[4]); startDraft({compFree:row[0]+': '+row[1], zustand:'', punkt:row[3], solltxt:row[4], lo:p.lo, hi:p.hi, einheit:p.unit, herkunft:1, notiz:row[6]?T('Fehlermuster: ','Неисправности: ')+row[6]:''}); }; });
    }
    inp.addEventListener('input', draw);
    main.querySelectorAll('#sysChips .chip').forEach(function(b){ b.onclick = function(){ state.sys = b.dataset.s; main.querySelectorAll('#sysChips .chip').forEach(function(x){ x.setAttribute('aria-pressed', x===b); }); draw(); }; });
    draw();
  });
  return h;
}

/* ---------- Tabellen ---------- */
function tabsDef(){ return [
  ['overview', T('Übersicht Bauteile','Сводка компонентов'), D.tables.overview],
  ['oszi', T('Oszilloskop-Startwerte','Настройки осциллографа'), D.tables.oszi],
  ['fehler', T('Fehlerbilder','Неисправности'), D.tables.fehler],
  ['hv', T('HV-Schnellreferenz','ВВ-справка'), D.tables.hv],
  ['obd', T('OBD-Stecker (Norm)','Разъём OBD (норма)'), X.obd],
  ['zustaende', T('Betriebszustände','Режимы работы'), X.zustaende],
  ['v33', T('V3.3 verifiziert','V3.3 проверено'), X.v33]
]; }
function vTables(tab){
  var defs = tabsDef(), cur0 = defs.filter(function(d){return d[0]===tab;})[0] || defs[0]; tab = cur0[0];
  var Tb = cur0[2];
  var h = '<div class="wrap">'+crumbs([T('Tabellen','Таблицы')])+'<h1>'+T('Referenztabellen','Справочные таблицы')+'</h1>' +
    '<div class="tabs" role="tablist">' + defs.map(function(d){ return '<button role="tab" aria-selected="'+(d[0]===tab)+'" data-tab="'+d[0]+'">'+esc(d[1])+'</button>'; }).join('') + '</div>';
  if (tab==='hv' || tab==='v33') h += hvCallout();
  if (tab==='oszi') h += '<p class="muted">'+T('Praxisübliche Startwerte, keine Herstellerspezifikation.','Практические стартовые значения, не спецификация производителя.')+'</p>';
  if (['obd','zustaende','v33'].indexOf(tab)>=0) h += '<p class="muted">'+T('Quelle: Kfz_Diagnosedatenbank V3.3 (Excel).','Источник: Kfz_Diagnosedatenbank V3.3 (Excel).')+'</p>';
  h += deNote().replace('Текст главы','Содержимое таблиц') + '<div class="filterbar"><input id="tblFilter" type="search" placeholder="'+T('Tabelle filtern','Фильтр таблицы')+'"><span class="muted" id="tblCount">'+Tb.rows.length+' '+T('Zeilen','строк')+'</span></div>' +
    '<div class="tbl big"><table><thead><tr>'+heads(tab,Tb.head).map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody id="tblBody">'+rows(Tb.rows)+'</tbody></table></div>'+foot()+'</div>';
  function rows(r){ return r.map(function(row){ return '<tr>'+row.map(function(c){return '<td>'+c+'</td>';}).join('')+'</tr>'; }).join(''); }
  after(function(){
    main.querySelectorAll('.tabs button').forEach(function(b){ b.onclick = function(){ go('tab-'+b.dataset.tab); }; });
    var inp = $('#tblFilter'); inp.addEventListener('input', function(){ var q = norm(inp.value); var r = Tb.rows.filter(function(row){ return !q || norm(strip(row.join(' '))).indexOf(q)>=0; }); $('#tblBody').innerHTML = rows(r); $('#tblCount').textContent = r.length+' '+T('Zeilen','строк'); });
  });
  return h;
}

/* ---------- Merkliste, Quellen, Suche ---------- */
function vFav(){
  var list = state.fav.map(function(i){return byId[i];}).filter(Boolean);
  return '<div class="wrap"><h1>'+T('Merkliste','Избранное')+'</h1>' + (list.length ? '<div class="item-list">'+list.map(card).join('')+'</div>' :
    '<div class="empty"><p>'+T('Noch nichts gemerkt. In jedem Kapitel gibt es oben „Merken“.','Пока пусто. В каждой главе вверху есть кнопка «В избранное».')+'</p><a class="btn" href="#kat-sensoren">'+T('Kapitel durchsuchen','Открыть главы')+'</a></div>') + foot() + '</div>';
}
function vAbout(){
  var m = D.meta, v = m.verify;
  return '<div class="wrap content"><h1>'+T('Quellen und Methode','Источники и метод')+'</h1>' +
    '<h3>'+T('Woraus JC Diagnose besteht','Из чего состоит JC Diagnose')+'</h3><ul>' +
    '<li><b>Kfz-Diagnose Nachschlagewerk '+esc(m.version)+'</b> ('+esc(m.stand)+'): '+m.n_items+' '+T('Kapitel','глав')+', '+m.n_sources+' '+T('Quellen','источников')+'. '+T('Kernwerte geprüft','Проверено ключевых значений')+': '+v.confirmed+' '+T('bestätigt','подтверждено')+', '+v.partial+' '+T('teilweise','частично')+', '+v.missing+' '+T('nicht in Quelle','нет в источнике')+', '+v.conflict+' '+T('korrigiert','исправлено')+'.</li>' +
    '<li><b>'+esc(X.meta.title)+'</b> ('+esc(X.meta.stand)+'): '+X.systemtests.rows.length+' '+T('Systemtests','системных тестов')+', '+X.zustaende.rows.length+' '+T('Betriebszustände','режимов')+', '+T('OBD-Normpins','нормированные контакты OBD')+', '+X.v33.rows.length+' '+T('verifizierte Ergänzungen (Pico, Tesla)','проверенных дополнений (Pico, Tesla)')+', '+X.marken.length+' '+T('Marken für die Fahrzeugauswahl','марок для выбора авто')+'.</li>' +
    '<li><b>DiagLab</b>: '+T('Datenmodell mit Herkunft jedes Sollwerts (0 bestätigt, 1 typisch, 2 Meister, 3 offen) und Soll/Ist-Bewertung.','модель данных с источником каждой нормы (0 подтверждено, 1 типовое, 2 мастер, 3 не определено) и оценкой «норма/факт».')+'</li></ul>' +
    '<h3>'+T('Stand der Excel-Datenbank','Состояние Excel-базы')+'</h3><dl class="quick">'+X.meta.start.slice(1).map(function(r){ return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>'; }).join('')+'</dl>' +
    '<h3>'+T('Grenzen','Ограничения')+'</h3><ul><li>'+T('Richtwerte ersetzen keine Herstellerdaten (HaynesPro, ESI[tronic], ELSA/erWin, ISTA, XENTRY, Autodata).','Ориентиры не заменяют данные производителя (HaynesPro, ESI[tronic], ELSA/erWin, ISTA, XENTRY, Autodata).')+'</li><li>'+T('Pinbelegungen sind nicht genormt; in der Excel-DB sind 0 OEM-Pins verifiziert.','Распиновки не стандартизованы; в Excel-базе подтверждено 0 OEM-контактов.')+'</li><li>'+T('Hochvolt nur mit Qualifikation nach DGUV Information 209-093.','ВВ только с допуском по DGUV Information 209-093.')+'</li><li>'+T('Kapiteltexte sind deutsch; die russische Übersetzung folgt.','Тексты глав на немецком; русский перевод — следующий этап.')+'</li></ul>' + foot() + '</div>';
}
function vSearch(q){
  var terms = norm(q.trim()).split(/\s+/).filter(Boolean), res = [];
  D.items.forEach(function(it){
    var tt = norm(it.title+' '+it.title_ru), tx = norm(it.text), score = 0, ok = true;
    terms.forEach(function(w){ var a = tt.indexOf(w)>=0, b = tx.indexOf(w)>=0; if (!a && !b) ok = false; score += (a?10:0) + (b?1:0); });
    if (ok && terms.length) res.push({it:it, s:score});
  });
  res.sort(function(a,b){return b.s-a.s;});
  var st = X.systemtests.rows.filter(function(r){ var t = norm(strip(r.join(' '))); return terms.length && terms.every(function(w){ return t.indexOf(w)>=0; }); });
  var dc = q.split(/[\s,;]+/).filter(function(w){ return /^[pcbu][0-3][0-9a-f]{3}$/i.test(w); }).map(dtcNorm).filter(Boolean);
  var h = '<div class="wrap"><h1>'+T('Suche','Поиск')+'</h1>' + (dc.length ? '<div class="mess-list" style="margin-bottom:16px">'+dc.slice(0,3).map(function(c){ return dtcCard(dtcAdvice(c)); }).join('')+'</div>' : '') + '<p class="lead">'+T('Treffer für','Найдено по запросу')+' „'+esc(q)+'“: '+(res.length+st.length)+'</p><div class="results">';
  h += res.slice(0,60).map(function(r){
    var tx = r.it.text, p = norm(tx).indexOf(terms[0]); var s = Math.max(0,p-70), snip = esc(tx.slice(s, s+200));
    terms.forEach(function(w){ snip = snip.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>'); });
    return '<a class="result" href="#b-'+r.it.id+'"><div class="rt">'+esc(L(r.it,'title'))+' <span class="badge'+(r.it.hv?' hv':'')+'">'+esc(L(catById[r.it.cat],'name'))+'</span></div><div class="snip">'+(s>0?'…':'')+snip+'…</div></a>';
  }).join('');
  h += st.slice(0,20).map(function(r){ return '<a class="result" href="#systemtests"><div class="rt">'+esc(strip(r[1]))+' <span class="badge info">'+T('Systemtest','Системный тест')+' · '+esc(strip(r[0]))+'</span></div><div class="snip">'+esc(strip(r[3]))+' — '+esc(strip(r[4]))+'</div></a>'; }).join('');
  if (!res.length && !st.length) h += '<div class="empty"><p>'+T('Kein Treffer. Deutsche Fachbegriffe funktionieren am besten (Kapiteltexte sind deutsch), z. B. Lambda, Kurbelwelle, P0335.','Ничего не найдено. Лучше искать немецкими терминами или по названию главы (тексты на немецком), напр. Lambda, Kurbelwelle, P0335, «коленвал».')+'</p></div>';
  return h + '</div></div>';
}
function vNotFound(){ return '<div class="wrap"><div class="empty"><p>'+T('Seite nicht gefunden.','Страница не найдена.')+'</p><a class="btn" href="#start">'+T('Zur Startseite','На главную')+'</a></div></div>'; }

/* ---------- Oszillogramme (eigene Kurven aus scope.ts + eigene Texte) ---------- */
var OSZ = window.OSZ || {waves:{}, map:{}, notes:{}}, JCX = window.JCX || null;
var GROUP_RU = {'Drehzahl':'Обороты','Stellung':'Положение','Luft/Druck':'Воздух/давление','Abgas':'Выхлоп','Temperatur':'Температура','Einspritzung/Zündung':'Впрыск/зажигание','Fahrwerk':'Ходовая','Aktoren':'Исполнительные','Methode':'Методы','Bordnetz':'Бортсеть','Mechanik':'Механика','Bus':'Шины'};
function scopeSvg(kind){
  var tr = JCX ? JCX.traces(kind) : '';
  var grid = ''; for (var i=0;i<12;i++) grid += '<line x1="'+(28+i*58)+'" y1="22" x2="'+(28+i*58)+'" y2="246" stroke="#1a4068"/>';
  for (var j=0;j<6;j++) grid += '<line x1="24" y1="'+(28+j*36)+'" x2="696" y2="'+(28+j*36)+'" stroke="#1a4068"/>';
  var w = OSZ.waves[kind], nm = w ? (state.lang==='ru'?w.ru.n:w.de.n) : kind;
  return '<svg viewBox="0 0 720 292" role="img" aria-label="'+esc(nm)+'" style="width:100%;height:auto;display:block;border-radius:12px"><rect width="720" height="292" rx="14" fill="#0c2342"/><g stroke-width="1">'+grid+'</g>'+tr+
    '<circle cx="48" cy="270" r="5" fill="#2ee6c7"/><text x="60" y="274" fill="#d5e4ef" font-size="13" font-family="system-ui,sans-serif">'+T('Sollbild','эталон')+'</text><circle cx="160" cy="270" r="5" fill="#ff5d6c"/><text x="172" y="274" fill="#d5e4ef" font-size="13" font-family="system-ui,sans-serif">'+T('Fehlerbild','неисправность')+'</text><circle cx="300" cy="270" r="5" fill="#7eb6ff"/><text x="312" y="274" fill="#d5e4ef" font-size="13" font-family="system-ui,sans-serif">'+T('2. Kanal / Strom','2-й канал / ток')+'</text></svg>';
}
function waveBlock(kind, compId){
  var w = OSZ.waves[kind]; if (!w) return '';
  var t = state.lang==='ru' ? w.ru : w.de;
  var users = Object.keys(OSZ.map).filter(function(k){ return OSZ.map[k].indexOf(kind)>=0 && byId[k] && k!==compId; });
  return '<section class="osz" id="w-'+kind+'"><div class="osz-head"><b>'+esc(t.n)+'</b><span class="badge">'+esc(T(w.g, GROUP_RU[w.g]||w.g))+'</span></div>'+scopeSvg(kind)+
    '<div class="osz-cols"><div><h4 class="okc">'+T('Sollbild','Норма')+'</h4><ul>'+t.ok.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div><div><h4 class="badc">'+T('Fehlerbilder','Неисправности')+'</h4><ul>'+t.bad.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul></div></div>' +
    '<p class="osz-set"><b>'+T('Einstellung','Настройка')+':</b> '+esc(t.set)+'</p>' +
    (compId ? '<div class="btn-row" style="margin:6px 0 0"><button class="btn small" data-wave="'+kind+'">+ '+T('Oszi-Messung erfassen','Записать замер осциллографом')+'</button></div>' :
      (users.length ? '<p class="meta">'+T('Verwendet in','Используется в')+': '+users.slice(0,8).map(function(k){ return '<a href="#b-'+k+'">'+esc(L(byId[k],'title'))+'</a>'; }).join(', ')+(users.length>8?' …':'')+'</p>' : '')) + '</section>';
}
function oszForItem(id){
  var kinds = OSZ.map[id] || []; if (!kinds.length) return '';
  var note = OSZ.notes[id];
  return '<h2>'+T('Oszillogramme','Осциллограммы')+'</h2>' + (note ? '<p class="note">'+esc(T(note[0],note[1]))+'</p>' : '') + '<div class="osz-list">'+kinds.map(function(k){ return waveBlock(k, id); }).join('')+'</div><p class="muted" style="font-size:var(--text-xs)">'+T('Schematische Kurven zur Orientierung (keine Messaufnahme). Genaue Werte im Kapitelabschnitt Oszilloskop und in den Herstellerdaten.','Схематичные кривые для ориентира (не реальная запись). Точные значения — в разделе главы «Oszilloskop» и в данных производителя.')+'</p>';
}
function bindWaves(id){
  main.querySelectorAll('[data-wave]').forEach(function(b){ b.onclick = function(){ var w = OSZ.waves[b.dataset.wave], t = state.lang==='ru'?w.ru:w.de; startDraft({comp:id, punkt:t.n, mittel:'Oszilloskop', herkunft:1, notiz:T('Einstellung: ','Настройка: ')+t.set}); }; });
}
function vOszi(){
  var groups = {}; Object.keys(OSZ.waves).forEach(function(k){ var g = OSZ.waves[k].g; (groups[g] = groups[g] || []).push(k); });
  var h = '<div class="wrap">'+crumbs([T('Oszillogramme','Осциллограммы')])+'<h1>'+T('Oszillogramme','Осциллограммы')+'</h1><p class="lead">'+T(Object.keys(OSZ.waves).length+' Kurvenarten mit Sollbild, Fehlerbild und Starteinstellung – zugeordnet zu '+Object.keys(OSZ.map).length+' Kapiteln.', Object.keys(OSZ.waves).length+' видов сигналов с эталоном, неисправностью и стартовой настройкой — привязаны к '+Object.keys(OSZ.map).length+' главам.')+'</p>' +
    '<div class="chips">'+Object.keys(groups).map(function(g){ return '<a class="chip" href="#oszi" data-jump="'+esc(groups[g][0])+'">'+esc(T(g, GROUP_RU[g]||g))+' ('+groups[g].length+')</a>'; }).join('')+'</div>';
  Object.keys(groups).forEach(function(g){ h += '<h2>'+esc(T(g, GROUP_RU[g]||g))+'</h2><div class="osz-list">'+groups[g].map(function(k){ return waveBlock(k, null); }).join('')+'</div>'; });
  h += '<p class="muted" style="font-size:var(--text-xs)">'+T('Kurven: eigener Zeichencode (scope.ts). Texte: eigene Formulierung. Schematisch, keine Messaufnahmen.','Кривые: собственный код отрисовки (scope.ts). Тексты: собственные формулировки. Схематично, не реальные записи.')+'</p>' + foot() + '</div>';
  after(function(){ main.querySelectorAll('[data-jump]').forEach(function(a){ a.onclick = function(e){ e.preventDefault(); var el = document.getElementById('w-'+a.dataset.jump); if (el) el.scrollIntoView({behavior:'smooth'}); }; }); });
  return h;
}

/* ---------- Fahrzeugdaten automatisch: VIN (09 02), Kilometerstand (01 A6), Marke aus WMI ---------- */
var WMI = {
 'WVW':'Volkswagen','WV1':'Volkswagen','WV2':'Volkswagen','WVG':'Volkswagen','WV3':'Volkswagen','1VW':'Volkswagen','3VW':'Volkswagen',
 'WAU':'Audi','WA1':'Audi','WUA':'Audi','TRU':'Audi',
 'WBA':'BMW/MINI','WBS':'BMW/MINI','WBY':'BMW/MINI','WBX':'BMW/MINI','WMW':'BMW/MINI','4US':'BMW/MINI','5UX':'BMW/MINI',
 'WDB':'Mercedes-Benz','WDD':'Mercedes-Benz','WDC':'Mercedes-Benz','WDF':'Mercedes-Benz','W1K':'Mercedes-Benz','W1N':'Mercedes-Benz','W1V':'Mercedes-Benz','W1W':'Mercedes-Benz','WMX':'Mercedes-Benz','4JG':'Mercedes-Benz',
 'WP0':'Porsche','WP1':'Porsche','VSS':'SEAT/Cupra','VS6':'SEAT/Cupra','TMB':'Skoda','TMP':'Skoda',
 'W0L':'Opel/Vauxhall','W0V':'Opel/Vauxhall','W0X':'Opel/Vauxhall','VXK':'Opel/Vauxhall','SXA':'Opel/Vauxhall',
 'VF1':'Renault','VF6':'Renault','VF8':'Renault','UU1':'Dacia','VF3':'Peugeot','VR3':'Peugeot','VF7':'Citroën/DS','VR7':'Citroën/DS','VR1':'Citroën/DS',
 'ZFA':'Fiat','ZFB':'Fiat','ZFC':'Fiat','ZAR':'Alfa Romeo','ZAC':'Jeep','1C4':'Jeep','1J4':'Jeep','1C3':'Chrysler/Dodge','2C3':'Chrysler/Dodge','1B3':'Chrysler/Dodge','2B3':'Chrysler/Dodge',
 'WF0':'Ford','WF1':'Ford','1FA':'Ford','1FM':'Ford','1FT':'Ford','3FA':'Ford','SFA':'Ford',
 'SAL':'Land Rover','SAJ':'Jaguar','YV1':'Volvo','YV4':'Volvo','LVY':'Volvo','YV2':'Volvo Trucks','YB3':'Volvo Trucks','YS2':'Scania',
 'JTD':'Toyota/Lexus','JTE':'Toyota/Lexus','JTH':'Toyota/Lexus','JTN':'Toyota/Lexus','JTM':'Toyota/Lexus','SB1':'Toyota/Lexus','NMT':'Toyota/Lexus','VNK':'Toyota/Lexus','4T1':'Toyota/Lexus','2T1':'Toyota/Lexus',
 'JHM':'Honda','JHL':'Honda','SHH':'Honda','SHS':'Honda','JMZ':'Mazda','JM1':'Mazda','JM3':'Mazda',
 'JN1':'Nissan','JN8':'Nissan','SJN':'Nissan','VSK':'Nissan','5N1':'Nissan','JMB':'Mitsubishi','JA3':'Mitsubishi','JA4':'Mitsubishi','XMC':'Mitsubishi',
 'JF1':'Subaru','JF2':'Subaru','JS2':'Suzuki','JS3':'Suzuki','TSM':'Suzuki','JSA':'Suzuki',
 'KMH':'Hyundai','KM8':'Hyundai','TMA':'Hyundai','NLH':'Hyundai','5NP':'Hyundai','KMT':'Genesis',
 'KNA':'Kia','KNE':'Kia','KND':'Kia','U5Y':'Kia','U6Y':'Kia',
 '5YJ':'Tesla','7SA':'Tesla','LRW':'Tesla','XP7':'Tesla','LGX':'BYD','LC0':'BYD','LSJ':'MG','SDP':'MG','LPS':'Polestar','YSM':'Polestar',
 '1G1':'Chevrolet','1GC':'Chevrolet','KL1':'Chevrolet','2G1':'Chevrolet','JAA':'Isuzu','JAL':'Isuzu','WMA':'MAN','XLR':'DAF','ZCF':'Iveco'
};
var VIN_YEAR = 'ABCDEFGHJKLMNPRSTVWXY123456789';
function vinInfo(vin){
  vin = String(vin||'').toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return null;
  var marke = WMI[vin.slice(0,3)] || '';
  var i = VIN_YEAR.indexOf(vin[9]), jahr = '';
  if (i>=0){ var y = 1980 + i, max = new Date().getFullYear() + 1; while (y + 30 <= max) y += 30; jahr = String(y); }
  return {vin:vin, marke:marke, jahr:jahr, wmi:vin.slice(0,3)};
}
function parseVinResponse(raw){
  var lines = String(raw||'').split(/[\r\n]+/).map(function(l){ return l.replace(/^\s*[0-9A-F]:\s*/i,'').replace(/[^0-9A-F]/gi,'').toUpperCase(); }).filter(Boolean);
  var hex = '';
  lines.forEach(function(l){
    if (l.length <= 3) return;                       // CAN-Längenzeile (z. B. 014)
    var k = l.indexOf('4902');
    if (k>=0) hex += l.slice(k+6);                   // 49 02 + Nachrichtennummer
    else hex += l;                                   // CAN-Folgezeile
  });
  var s = '';
  for (var j=0;j+1<hex.length;j+=2){ var c = parseInt(hex.substr(j,2),16); if (c>=48 && c<=90) s += String.fromCharCode(c); }
  s = s.replace(/[^A-HJ-NPR-Z0-9]/g,'');
  return s.length >= 17 ? s.slice(-17) : '';
}
function parseOdoResponse(raw){
  var h = String(raw||'').replace(/[^0-9A-F]/gi,'').toUpperCase(), k = h.indexOf('41A6');
  if (k<0 || h.length < k+12) return '';
  var v = parseInt(h.substr(k+4,8),16); if (isNaN(v)) return '';
  return String(Math.round(v/10));
}
function readVehicle(io){
  var out = {};
  return io.send('0902', 8000).then(function(r){ var v = parseVinResponse(r); if (v) { var inf = vinInfo(v); if (inf) Object.assign(out, inf); } }, function(){})
    .then(function(){ return io.send('01A6', 5000).then(function(r){ var km = parseOdoResponse(r); if (km) out.km = km; }, function(){}); })
    .then(function(){ return out; });
}
function vehToFz(veh, fz){
  fz = fz || {kz:'', marke:'', modell:'', vin:'', km:'', kunde:'', tel:''};
  if (!veh) return fz;
  if (veh.vin) {
    fz.vin = veh.vin;
    var known = state.archiv.find(function(r){ return r.fz && r.fz.vin && r.fz.vin.toUpperCase()===veh.vin; });
    if (known) ['kz','marke','modell','kunde','tel'].forEach(function(k){ if (!fz[k] && known.fz[k]) fz[k] = known.fz[k]; });
  }
  if (veh.marke && !fz.marke) fz.marke = veh.marke;
  if (veh.jahr && !fz.modell) fz.modell = 'MJ ' + veh.jahr;
  if (veh.km) fz.km = veh.km;
  return fz;
}
function vehKnown(vin){ return vin ? state.archiv.filter(function(r){ return r.fz && r.fz.vin && r.fz.vin.toUpperCase()===vin; }) : []; }

/* ---------- OBD-Verbindung (eigener ELM327-Code aus kfz-diagnose) ---------- */
var PID_RU = {5:'Температура ОЖ',12:'Обороты',13:'Скорость',15:'Темп. впускного воздуха',4:'Нагрузка',6:'Краткосрочная коррекция',11:'Давление во впуске',17:'Положение дросселя',66:'Напряжение блока'};
var obd = {io:null, name:'', info:null, proto:'auto', dtcs:null, live:[], liveOn:false, busy:'', err:'', log:[], sup:null, sel:lget('jc-pids', null), cyc:0};
if (!obd.sel && window.JCPID) obd.sel = JCPID.presets.basis.p.slice();
function obdLog(t){ obd.log.unshift(new Date().toLocaleTimeString()+' · '+t); obd.log = obd.log.slice(0,60); }
function obdRefresh(){ if (cur()==='obd') render(true); }
function obdRun(label, fn){
  obd.busy = label; obd.err = ''; obdRefresh();
  return Promise.resolve().then(fn).then(function(){ obd.busy = ''; obdRefresh(); }, function(e){ obd.busy = ''; obd.err = (e && e.message) || String(e); obdLog('Fehler: '+obd.err); obdRefresh(); });
}
function obdConnect(kind){
  if (!JCX) return;
  if (kind==='wifi'){ var wi = $('#wifiAddr'); if (wi && wi.value.trim()) lset('jc-wifi', wi.value.trim()); }
  var proto = JCX.protocolById(obd.proto);
  obdRun(T('Verbinde …','Подключение …'), function(){
    var p = connectBy(kind);
    return p.then(function(c){ obd.io = c.io; obd.name = c.name; obdLog(T('Verbunden: ','Подключено: ')+c.name); return JCX.initAdapter(c.io, proto); })
      .then(function(info){ obd.info = info; obd.dtcs = null; obd.live = []; obdLog(T('Protokoll: ','Протокол: ')+info.name+(info.warning?' · '+info.warning:''));
        obd.busy = T('Lese VIN und Kilometerstand …','Читаю VIN и пробег …'); obdRefresh();
        return readVehicle(obd.io).then(function(v){ obd.veh = v; obdLog('VIN: '+(v.vin||T('nicht lesbar','не читается'))+(v.marke?' · '+v.marke:'')+(v.jahr?' · MJ '+v.jahr:'')+' · km: '+(v.km||T('nicht unterstützt','не поддерживается')));
          if (state.diag){ state.diag.fz = vehToFz(v, state.diag.fz); diagSave(); } }); })
      .then(function(){ if (!window.JCPID) return; obd.busy = T('Ermittle unterstützte Live-Daten …','Определяю доступные живые данные …'); obdRefresh();
        return JCPID.supported(obd.io, obdLog).then(function(l){ obd.sup = l; obdLog(T('Unterstützte PIDs: ','Поддерживаемых PID: ')+l.length+' ('+l.map(JCPID.hex).join(' ')+')'); }, function(e){ obd.sup = null; obdLog('PID-Liste: '+e.message); }); });
  });
}

var WIFI_DEF = '192.168.0.10:35000';
function nc(){ return (JCX && JCX.nativeCaps) ? JCX.nativeCaps() : {app:null,spp:false,tcp:false,ble:false}; }
function connectBy(kind){
  var c = nc();
  if (kind==='demo') return Promise.resolve({io:demoIo(), name:T('Demo-Fahrzeug','Демо-автомобиль')});
  if (kind==='ble' || kind==='bleall') return c.ble ? JCX.connectBleNative() : JCX.connectBluetooth(kind==='bleall');
  if (kind==='spp') return JCX.connectSppNative(window.JCPICK);
  if (kind==='wifi'){
    var v = String(lget('jc-wifi', WIFI_DEF)).trim() || WIFI_DEF;
    var t = JCX.parseWifiTarget(v, 35000);
    if (t.error) return Promise.reject(new Error(t.error));
    if (c.tcp) return JCX.connectTcpNative(t.host, t.port);
    return JCX.connectWifi(v, 35000).then(function(io){ return {io:io, name:'WLAN '+v}; });
  }
  return JCX.connectSerial(38400);
}
/* Auswahl-Fenster (gekoppelte Bluetooth-Geräte, Windows-Geräteliste, COM-Ports) */
var pickUI = null;
function pickOpen(title, items, onChoose){
  if (!pickUI){ var ov = document.createElement('div'); ov.className = 'pick-ov'; document.body.appendChild(ov); pickUI = {ov:ov}; }
  pickUI.onChoose = onChoose;
  var ov = pickUI.ov;
  ov.innerHTML = '<div class="pick-box" role="dialog" aria-modal="true"><h2>'+esc(title)+'</h2><div class="pick-list">'+(items.length ? items.map(function(it,i){ return '<button class="btn" data-pi="'+i+'"><b>'+esc(it.label)+'</b>'+(it.sub?'<span class="meta"> · '+esc(it.sub)+'</span>':'')+'</button>'; }).join('') : '<p class="muted">'+T('Suche läuft … Adapter einschalten und in der Nähe halten.','Идёт поиск … включи адаптер и держи рядом.')+'</p>')+'</div><button class="btn" data-pi="-1">'+T('Abbrechen','Отмена')+'</button></div>';
  ov.querySelectorAll('[data-pi]').forEach(function(b){ b.onclick = function(){ var i = +b.dataset.pi, cb = pickUI.onChoose; ov.remove(); pickUI = null; cb(i<0 ? null : items[i].id); }; });
}
window.JCPICK = function(title, items){ return new Promise(function(res){ pickOpen(title, items, res); }); };
if (window.JCDesktop && window.JCDesktop.onPick) window.JCDesktop.onPick(function(m){
  pickOpen(m.kind==='serial' ? T('COM-Port wählen (Bluetooth-Adapter erscheint hier, wenn er in Windows gekoppelt ist)','Выбери COM-порт (Bluetooth-адаптер появится здесь, если он сопряжён в Windows)') : T('Bluetooth-Gerät wählen','Выбери Bluetooth-устройство'),
    (m.list||[]).map(function(d){ return {id:d.id, label:d.name||d.id, sub:d.sub||''}; }),
    function(id){ window.JCDesktop.pick(m.kind, id||''); });
});
function demoIo(){
  var base = JCX.createDemoElm('obd');
  return { send:function(cmd, t){ var c = cmd.replace(/\s/g,'').toUpperCase();
      if (c==='0902') return Promise.resolve('014\n0:490201575657\n1:5A5A5A41555A47\n2:57303030303031');
      if (c==='01A6') return Promise.resolve('41A6001E3A2C');
      if (window.JCPID){ var dm = JCPID.demo(c, Date.now()); if (dm) return new Promise(function(r){ setTimeout(function(){ r(dm); }, 25); }); }
      return base.send(cmd, t); }, close:function(){ return base.close(); } };
}
function obdDisconnect(){ obd.veh = null; obd.liveOn = false; obd.sup = null; var io = obd.io; obd.io = null; obd.info = null; obd.live = []; if (io) io.close().catch(function(){}); obdLog(T('Getrennt','Отключено')); obdRefresh(); }
function obdLiveLoop(){
  if (!obd.liveOn || !obd.io) return;
  var t0 = Date.now(), list = livePids();
  if (!list.length){ obd.liveOn = false; obd.err = T('Keine Live-Werte ausgewählt.','Не выбрано ни одного значения.'); obdRefresh(); return; }
  JCPID.read(obd.io, list).then(function(r){ if (!r.length && obd.liveOn){ obd.liveOn = false; obd.err = T('Das Fahrzeug liefert keine Werte. Zündung an? Antworten des Adapters: ','Машина не отдаёт значений. Зажигание включено? Ответы адаптера: ')+((r.diag||[]).join(' | ')||'–'); obdLog(obd.err); obdRefresh(); return; } obd.live = r; obd.cyc = (Date.now()-t0)/1000; if (cur()==='obd') drawLive(); if (obd.liveOn) setTimeout(obdLiveLoop, 150); }, function(e){ obd.liveOn = false; obd.err = e.message; obdRefresh(); });
}
function livePids(){ var sel = obd.sel || []; return obd.sup ? sel.filter(function(p){ return obd.sup.indexOf(p) >= 0; }) : sel; }
function pidPicker(){
  if (!window.JCPID) return '';
  var avail = obd.sup ? JCPID.list.filter(function(p){ return obd.sup.indexOf(p.pid) >= 0; }) : JCPID.list;
  var unknown = obd.sup ? obd.sup.filter(function(p){ return !JCPID.by[p]; }) : [];
  var groups = {}; avail.forEach(function(p){ (groups[p.g] = groups[p.g] || []).push(p); });
  var h = '<div class="pid-pre">'+Object.keys(JCPID.presets).map(function(k){ var pr = JCPID.presets[k]; return '<button class="btn small" data-pre="'+k+'">'+esc(T(pr.de, pr.ru))+'</button>'; }).join('')+
    '<button class="btn small" data-pre="_all">'+T('Alle','Все')+'</button><button class="btn small" data-pre="_none">'+T('Keine','Ничего')+'</button></div>';
  h += '<details class="pid-pick"'+(obd.pickOpen?' open':'')+'><summary>'+T('Werte auswählen','Выбрать значения')+' · '+livePids().length+' '+T('von','из')+' '+(avail.length+unknown.length)+(obd.sup?' '+T('vom Fahrzeug unterstützt','поддерживает машина'):' ('+T('Liste noch nicht vom Fahrzeug gelesen','список ещё не прочитан из машины')+')')+'</summary>';
  Object.keys(JCPID.groups).forEach(function(g){ var arr = groups[g]; if (!arr) return; var gn = JCPID.groups[g];
    h += '<fieldset class="pid-grp"><legend>'+esc(T(gn[0], gn[1]))+'</legend>'+arr.map(function(p){ return '<label><input type="checkbox" data-pid="'+p.pid+'"'+((obd.sel||[]).indexOf(p.pid)>=0?' checked':'')+'> <span class="mono">'+JCPID.hex(p.pid)+'</span> '+esc(state.lang==='ru'?p.ru:p.de)+'</label>'; }).join('')+'</fieldset>'; });
  if (unknown.length) h += '<fieldset class="pid-grp"><legend>'+T('Weitere (ohne Umrechnung, Rohdaten)','Прочие (без расшифровки, сырые данные)')+'</legend>'+unknown.map(function(p){ return '<label><input type="checkbox" data-pid="'+p+'"'+((obd.sel||[]).indexOf(p)>=0?' checked':'')+'> <span class="mono">'+JCPID.hex(p)+'</span></label>'; }).join('')+'</fieldset>';
  h += '</details>';
  return h;
}
function bindPids(){
  main.querySelectorAll('[data-pre]').forEach(function(b){ b.onclick = function(){ var k = b.dataset.pre, all = obd.sup || JCPID.list.map(function(p){ return p.pid; });
    obd.sel = k==='_all' ? all.slice() : k==='_none' ? [] : JCPID.presets[k].p.slice(); lset('jc-pids', obd.sel); render(true); }; });
  main.querySelectorAll('[data-pid]').forEach(function(c){ c.onchange = function(){ var p = +c.dataset.pid, sel = obd.sel || []; var i = sel.indexOf(p); if (c.checked && i<0) sel.push(p); if (!c.checked && i>=0) sel.splice(i,1); obd.sel = sel; lset('jc-pids', sel); obd.pickOpen = true; render(true); }; });
  var d = main.querySelector('.pid-pick'); if (d) d.ontoggle = function(){ obd.pickOpen = d.open; };
  var bs = $('#bSnap'); if (bs) bs.onclick = function(){ var list = obd.sup || JCPID.list.map(function(p){ return p.pid; }); obd.liveOn = false;
    obdRun(T('Lese alle unterstützten Werte …','Читаю все доступные значения …'), function(){ var t0 = Date.now(); return JCPID.read(obd.io, list).then(function(r){ obd.live = r; obd.cyc = (Date.now()-t0)/1000; obdLog(T('Momentaufnahme: ','Снимок: ')+r.length+' '+T('Werte','значений')); if (!r.length && r.diag && r.diag.length) obdLog(T('Keine Werte. Antworten des Adapters: ','Нет значений. Ответы адаптера: ')+r.diag.join(' | ')); }); }); };
}
function liveTiles(){
  if (!obd.live.length) return '<p class="muted">'+T('Noch keine Werte.','Значений пока нет.')+'</p>';
  return (obd.cyc ? '<p class="meta">'+obd.live.length+' '+T('Werte','значений')+' · '+T('Zyklus','цикл')+' '+obd.cyc.toFixed(1).replace('.',',')+' s</p>' : '')+'<div class="live-grid">'+obd.live.map(function(r,i){ var it = r.chapter && byId[r.chapter]; return '<div class="live'+(r.warn?' warn':'')+'"><span class="lbl"><span class="mono">'+(window.JCPID?JCPID.hex(r.pid):'')+'</span> '+esc(r.label)+'</span><b>'+esc(r.text)+'</b><span class="meta">'+esc(r.note)+'</span><span class="btn-row" style="margin:4px 0 0"><button class="btn small" data-take="'+i+'">'+T('→ Messung','→ Замер')+'</button>'+(it?'<a class="btn small" href="#b-'+it.id+'">'+T('Kapitel','Глава')+'</a>':'')+'</span></div>'; }).join('')+'</div>';
}
function drawLive(){ var el = $('#liveBox'); if (!el) return; el.innerHTML = liveTiles(); bindTake(); }
function bindTake(){ main.querySelectorAll('[data-take]').forEach(function(b){ b.onclick = function(){ var r = obd.live[+b.dataset.take]; if (!r) return; var isNum = r.value != null || (r.value === undefined && /^-?\d/.test(r.text)), m = isNum ? String(r.text).match(/-?\d+(?:[.,]\d+)?/) : null, u = m ? String(r.text).slice(m.index+m[0].length).trim() : ''; obd.liveOn = false; startDraft({comp:r.chapter||'', punkt:r.label+' (PID '+r.pid.toString(16).toUpperCase()+')', mittel:'Diagnosetester (Istwert)', ist:m?m[0].replace('.',','):'', einheit:m?u:'', notiz:'OBD: '+obd.name+(m?'':' · '+r.text)}); }; }); }
function dtcList(arr, title){ if (!arr || !arr.length) return '<p class="meta">'+esc(title)+': '+T('keine','нет')+'</p>'; return '<h3>'+esc(title)+' ('+arr.length+')</h3><div class="mess-list">'+arr.map(function(c){ return dtcCard(dtcAdvice(c)); }).join('')+'</div>'; }
function vehCard(v){
  var kn = vehKnown(v.vin), last = kn[0];
  return '<dl class="quick veh">' +
    '<div><dt>VIN</dt><dd class="mono">'+(v.vin?esc(v.vin):'<span class="muted">'+T('nicht gelesen','не прочитан')+'</span>')+'</dd></div>' +
    '<div><dt>'+T('Marke (aus VIN)','Марка (по VIN)')+'</dt><dd>'+(v.marke?esc(v.marke):'<span class="muted">'+(v.vin?T('Hersteller-Code ','код изготовителя ')+esc(v.wmi):'–')+'</span>')+'</dd></div>' +
    '<div><dt>'+T('Modelljahr (ca.)','Модельный год (ориентир)')+'</dt><dd>'+(v.jahr?esc(v.jahr):'–')+'</dd></div>' +
    '<div><dt>'+T('Kilometerstand','Пробег')+'</dt><dd>'+(v.km?esc(Number(v.km).toLocaleString(state.lang==='ru'?'ru-RU':'de-DE'))+' km':'<span class="muted">'+T('vom Fahrzeug nicht unterstützt – bitte eintragen','машина не отдаёт — впиши вручную')+'</span>')+'</dd></div>' +
    (last ? '<div class="wide"><dt>'+T('Bekanntes Fahrzeug','Машина уже есть в архиве')+'</dt><dd>'+esc(fzSummary(last.fz))+' · '+kn.length+' '+T('Bericht(e)','отчёт(ов)')+' · <a href="#berichte" data-vinq="'+esc(v.vin)+'">'+T('anzeigen','показать')+'</a></dd></div>' : '') +
    '</dl><p class="meta">'+T('Werden beim Start der Diagnose automatisch in „Fahrzeug und Kunde“ eingetragen.','При запуске диагностики автоматически заносятся в «Автомобиль и клиент».')+'</p>';
}
function vObd(){
  var ok = !!JCX, c = nc();
  var bleWhy = ok ? (c.ble ? null : JCX.bluetoothUnavailableReason()) : 'Modul fehlt', serWhy = ok ? JCX.serialUnavailableReason() : 'Modul fehlt';
  var sppWhy = !c.spp ? (c.app==='desktop' ? T('Am Rechner: Adapter in Windows koppeln (Einstellungen → Bluetooth), dann „USB / COM“ wählen.','На ПК: сопрями адаптер в Windows (Параметры → Bluetooth), затем выбери «USB / COM».') : T('Klassisches Bluetooth (die meisten günstigen ELM327) geht nur in der Android-App.','Классический Bluetooth (большинство дешёвых ELM327) работает только в Android-приложении.')) : null;
  var wifiOk = ok && (c.tcp || (typeof TCPSocket==='function'));
  var h = '<div class="wrap">'+crumbs(['OBD'])+'<h1>'+T('Fahrzeug verbinden (OBD)','Подключение к машине (OBD)')+'</h1><p class="lead">'+T('ELM327 / STN-Adapter: Fehlerspeicher lesen und löschen, Live-Daten, Werte direkt ins Messprotokoll.','Адаптер ELM327 / STN: чтение и сброс ошибок, живые данные, значения сразу в журнал замеров.')+'</p>';
  if (!obd.io){
    h += '<fieldset class="fs"><legend>'+T('Protokoll','Протокол')+'</legend><div class="form-grid"><div class="field wide"><label for="obdProto">'+T('Protokoll (Automatisch passt fast immer)','Протокол («автоматически» подходит почти всегда)')+'</label><select id="obdProto">'+(ok?JCX.protocolGroups().map(function(g){ return '<optgroup label="'+esc(g.group)+'">'+g.items.map(function(p){ return '<option value="'+p.id+'"'+(p.id===obd.proto?' selected':'')+'>'+esc(p.label)+'</option>'; }).join('')+'</optgroup>'; }).join(''):'')+'</select></div></div><p class="meta" id="protoDetail">'+(ok?esc(JCX.protocolById(obd.proto).detail):'')+'</p></fieldset>' +
      '<div class="cat-grid">' +
      '<a class="cat-card" href="#import"><div class="top"><b>'+T('Bericht importieren','Импорт отчёта')+'</b></div><p>'+T('PDF oder Text eines anderen Diagnosegeräts (Launch, Autel …) einlesen und prüfen.','PDF или текст отчёта другого прибора (Launch, Autel …): разобрать и проверить.')+'</p></a>' +
      '<button class="cat-card conn" data-conn="demo"><div class="top"><b>'+T('Demo-Fahrzeug','Демо-автомобиль')+'</b></div><p>'+T('Ohne Adapter testen: Codes P0118, P0301 … und Live-Daten.','Проверка без адаптера: коды P0118, P0301 … и живые данные.')+'</p></button>' +
      '<button class="cat-card conn" data-conn="ble"'+(bleWhy?' disabled':'')+'><div class="top"><b>Bluetooth LE</b></div><p>'+(bleWhy?esc(bleWhy):T('Vgate iCar Pro BLE, OBDLink CX, Veepeak BLE, Carista, Konnwei u. a.','Vgate iCar Pro BLE, OBDLink CX, Veepeak BLE, Carista, Konnwei и др.'))+'</p>'+((bleWhy||c.ble)?'':'<span class="meta"><a href="#obd" data-conn="bleall">'+T('Adapter nicht gefunden? Alle Geräte zeigen','Адаптер не найден? Показать все устройства')+'</a></span>')+'</button>' +
      '<button class="cat-card conn" data-conn="spp"'+(sppWhy?' disabled':'')+'><div class="top"><b>'+T('Bluetooth klassisch (SPP)','Bluetooth классический (SPP)')+'</b></div><p>'+(sppWhy?esc(sppWhy):T('Gekoppelter ELM327 (die meisten günstigen Adapter, Name „OBDII“, „ELM327“). Vorher in den Android-Einstellungen koppeln, PIN 1234 oder 0000.','Сопряжённый ELM327 (большинство дешёвых адаптеров, имя «OBDII», «ELM327»). Заранее сопрягай в настройках Android, PIN 1234 или 0000.'))+'</p></button>' +
      '<button class="cat-card conn" data-conn="serial"'+(serWhy?' disabled':'')+'><div class="top"><b>USB / COM</b></div><p>'+(serWhy?esc(serWhy):T('USB-ELM327 oder in Windows gekoppeltes Bluetooth (COM-Port), 38400 Baud.','USB-ELM327 или сопряжённый в Windows Bluetooth (COM-порт), 38400 бод.'))+'</p></button>' +
      '</div>' +
      '<fieldset class="fs"><legend>WLAN / Wi-Fi</legend><div class="form-grid"><div class="field wide"><label for="wifiAddr">'+T('Adresse des WLAN-Adapters (Host:Port)','Адрес Wi-Fi-адаптера (хост:порт)')+'</label><input id="wifiAddr" type="text" inputmode="url" autocomplete="off" value="'+esc(lget('jc-wifi', WIFI_DEF))+'"></div></div>' +
      '<div class="btn-row"><button class="btn primary conn" data-conn="wifi"'+(wifiOk?'':' disabled')+'>'+T('Per WLAN verbinden','Подключиться по Wi-Fi')+'</button><button class="btn" data-wq="192.168.0.10:35000">192.168.0.10:35000</button><button class="btn" data-wq="192.168.4.1:35000">192.168.4.1:35000</button><button class="btn" data-wq="192.168.0.74:23">192.168.0.74:23</button></div>' +
      '<p class="meta">'+(wifiOk?T('Erst mit dem WLAN des Adapters verbinden (Name oft „OBDII“, „WiFi_OBDII“, „V-LINK“), dann hier verbinden. Standard: 192.168.0.10, Port 35000.','Сначала подключись к Wi-Fi адаптера (имя часто «OBDII», «WiFi_OBDII», «V-LINK»), потом жми здесь. По умолчанию: 192.168.0.10, порт 35000.'):T('WLAN-Adapter spricht rohes TCP – das kann nur die Android-App oder die Windows-App, kein Browser.','Wi-Fi-адаптер говорит по чистому TCP — это умеет только Android-приложение или Windows-приложение, не браузер.'))+'</p></fieldset>' +
      '<div class="callout"><b>'+T('Gut zu wissen','Полезно знать')+'</b><p>'+(c.app ? T('Du nutzt die App: Bluetooth LE, klassisches Bluetooth und WLAN werden direkt unterstützt (Windows: Bluetooth über COM-Port).','Ты в приложении: Bluetooth LE, классический Bluetooth и Wi-Fi поддерживаются напрямую (Windows: Bluetooth через COM-порт).') : T('Im Browser gehen nur Bluetooth LE und USB/COM. Für klassisches Bluetooth und WLAN die Android-App oder die Windows-App aus den Downloads unten verwenden. Am iPhone geht Bluetooth im Browser nicht.','В браузере работают только Bluetooth LE и USB/COM. Для классического Bluetooth и Wi-Fi используй Android-приложение или приложение для Windows (ссылки внизу). На iPhone Bluetooth в браузере не работает.'))+'</p></div>';
  } else {
    var i = obd.info || {};
    h += '<div class="mess"><div class="r1"><b>'+esc(obd.name)+'</b><span class="st ok">'+T('verbunden','подключено')+'</span></div><div class="meta">'+esc(i.name||'')+(i.number?' · '+esc(i.number):'')+(i.can?' · CAN':'')+'</div>'+(i.warning?'<p class="note">'+esc(i.warning)+'</p>':'')+
      (obd.veh ? vehCard(obd.veh) : '')+'<div class="btn-row"><button class="btn primary" id="bRead">'+T('Fehler lesen','Прочитать ошибки')+'</button><button class="btn" id="bLive">'+(obd.liveOn?T('Live stoppen','Остановить')+' ■':T('Live-Daten','Живые данные')+' ▶')+'</button><button class="btn danger" id="bClear">'+T('Fehler löschen','Стереть ошибки')+'</button><button class="btn" id="bOff">'+T('Trennen','Отключить')+'</button></div></div>';
    h += '<h2>'+T('Live-Daten','Живые данные')+'</h2>'+pidPicker()+'<div class="btn-row"><button class="btn'+(obd.liveOn?'':' primary')+'" id="bLive2">'+(obd.liveOn?T('Live stoppen','Остановить')+' ■':T('Ausgewählte live lesen','Читать выбранные онлайн')+' ▶')+'</button><button class="btn" id="bSnap">'+T('Alle unterstützten einmal lesen','Прочитать все доступные один раз')+'</button><button class="btn" id="bProbe">'+T('Adapter-Test','Тест адаптера')+'</button></div><div class="btn-row"><input id="rawCmd" class="mono" placeholder="'+T('Befehl, z. B. 010C oder ATH1','Команда, напр. 010C или ATH1')+'" style="flex:1;min-width:0" autocapitalize="characters" autocomplete="off"><button class="btn" id="bRaw">'+T('Senden','Отправить')+'</button></div><div id="liveBox">'+liveTiles()+'</div>';
    if (obd.dtcs){
      var d = obd.dtcs;
      var allc = [].concat(d.stored.map(function(c){return {code:c,set:'stored'};}), d.permanent.map(function(c){return {code:c,set:'permanent'};}), d.pending.map(function(c){return {code:c,set:'pending'};}), (d.uds||[]).map(function(c){return {code:c,set:'uds'};}));
      if (allc.length) h += '<div class="callout"><b>'+T('Diagnose','Диагностика')+'</b><p>'+T('Alle Codes Schritt für Schritt abarbeiten: Prüfungen, Kapitel, Messungen, Ergebnis.','Пройти все коды по шагам: проверки, главы, замеры, итог.')+'</p><button class="btn primary" id="bDiag">'+T('Geführte Diagnose starten','Начать пошаговую диагностику')+' ('+allc.length+')</button></div>';
      after(function(){ var bd = $('#bDiag'); if (bd) bd.onclick = function(){ diagStart(allc, 'OBD'); }; });
      h += '<h2>'+T('Fehlerspeicher','Память ошибок')+'</h2>' + dtcList(d.stored, T('Gespeichert (03)','Сохранённые (03)')) + dtcList(d.pending, T('Anstehend (07)','Ожидающие (07)')) + dtcList(d.permanent, T('Permanent (0A)','Постоянные (0A)')) + (d.uds && d.uds.length ? dtcList(d.uds, 'UDS (19 02)') : '');
    }
  }
  if (obd.busy) h += '<p class="note">'+esc(obd.busy)+'</p>';
  if (obd.err) h += '<div class="callout hv"><b>'+T('Fehler','Ошибка')+'</b><p>'+esc(obd.err)+'</p></div>';
  if (obd.log.length) h += '<details style="margin-top:16px"><summary class="muted">'+T('Protokoll der Verbindung','Журнал соединения')+'</summary><pre class="copybox" style="white-space:pre-wrap">'+esc(obd.log.join('\n'))+'</pre></details>';
  h += '<p class="muted" style="font-size:var(--text-xs)">'+T('Code: eigener OBD-Kern aus kfz-diagnose (12 Tests bestanden) + Web-Serial-Anbindung.','Код: собственное OBD-ядро из kfz-diagnose (12 тестов пройдено) + подключение Web Serial.')+'</p>' + foot() + '</div>';
  after(function(){
    var ps = $('#obdProto'); if (ps) ps.onchange = function(){ obd.proto = ps.value; $('#protoDetail').textContent = JCX.protocolById(ps.value).detail; };
    main.querySelectorAll('[data-wq]').forEach(function(b){ b.onclick = function(){ var i = $('#wifiAddr'); if (i) i.value = b.dataset.wq; }; });
    main.querySelectorAll('[data-conn]').forEach(function(b){ b.onclick = function(e){ e.preventDefault(); e.stopPropagation(); obdConnect(b.dataset.conn); }; });
    var br = $('#bRead'); if (br) br.onclick = function(){ obdRun(T('Lese Fehlerspeicher …','Чтение ошибок …'), function(){ var pr = JCX.protocolById(obd.proto); return JCX.readAllDtcs(obd.io, !!(obd.info&&obd.info.can), pr.uds).then(function(d){ obd.dtcs = d; obdLog(T('Codes: ','Коды: ')+([].concat(d.stored,d.pending,d.permanent,d.uds).join(', ')||'–')); }); }); };
    ['#bLive','#bLive2'].forEach(function(id){ var bl = $(id); if (bl) bl.onclick = function(){ obd.liveOn = !obd.liveOn; obd.err = ''; if (obd.liveOn) obdLiveLoop(); render(true); }; });
    var bp = $('#bProbe'); if (bp) bp.onclick = function(){ obd.liveOn = false;
      obdRun(T('Adapter-Test …','Тест адаптера …'), async function(){
        var seq = ['ATRV','ATDPN','ATH1','0100','0105','010C','ATSH7E0','0105','010C','ATSH7E2','0100','0105','ATSH7DF','ATH0'];
        for (var i=0;i<seq.length;i++){ var r; try { r = await obd.io.send(seq[i], seq[i].indexOf('AT')===0 ? 2000 : 6000); } catch(e){ r = 'FEHLER '+(e && e.message || e); }
          obdLog('TEST '+seq[i]+' → '+String(r).replace(/\s+/g,' ').trim().slice(0,70)); }
      }); };
    var br = $('#bRaw'), rc = $('#rawCmd'); if (br && rc){ var go = function(){ var c = rc.value.trim().toUpperCase(); if (!c) return; obd.liveOn = false;
        obdRun(c, async function(){ var r; try { r = await obd.io.send(c, 8000); } catch(e){ r = 'FEHLER '+(e && e.message || e); } obdLog('CMD '+c+' → '+String(r).replace(/\s+/g,' ').trim().slice(0,90)); }); };
      br.onclick = go; rc.onkeydown = function(e){ if (e.key === 'Enter') go(); }; }
    if (window.JCPID) bindPids();
    var bc = $('#bClear'); if (bc) bc.onclick = function(){ if (!bc.dataset.sure){ bc.dataset.sure = 1; bc.textContent = T('Wirklich löschen? Motor aus, Zündung an','Точно стереть? Мотор стоит, зажигание вкл.'); return; } obdRun(T('Lösche …','Стираю …'), function(){ return JCX.clearDtcs(obd.io).then(function(){ obd.dtcs = null; obdLog(T('Fehlerspeicher gelöscht','Память ошибок стёрта')); }); }); };
    var bo = $('#bOff'); if (bo) bo.onclick = obdDisconnect;
    main.querySelectorAll('[data-vinq]').forEach(function(a){ a.onclick = function(){ state.berQ = a.dataset.vinq; }; });
    bindTake();
  });
  return h;
}

/* ---------- Geführte Diagnose (aus Fehlercodes) ---------- */
state.diag = lget('jc-diag', null);
state.archiv = lget('jc-archiv', []);
function archivSave(){ lset('jc-archiv', state.archiv); }
var cloudArch = null;
function diagSave(){ lset('jc-diag', state.diag); }
var SEVR = {hoch:0, mittel:1, niedrig:2};
function diagRank(c){ var a = dtcAdvice(c.code); var first = /^U0/.test(c.code) || /^P056[0-3]$/.test(c.code) || c.code==="P00FD" ? 0 : 1; var sv = a && a.t ? SEVR[a.t.severity] : 3; var st = {active:0, stored:0, permanent:1, pending:2, uds:3, manual:0}[c.set]; return [first, sv==null?3:sv, st==null?4:st]; }
function diagBuild(code, set, ex){
  var a = dtcAdvice(code), steps = [];
  if (ex && (ex.desc || ex.ftb)){
    var fi = ex.ftb && window.JCREP ? JCREP.ftbInfo(ex.ftb) : null;
    steps.push({k:'check', t:T('Laut Bericht: ','Согласно отчёту: ')+(ex.desc||code)+(fi ? ' · '+T('Fehlerart ','Тип ошибки ')+ex.ftb+': '+T(fi.de,fi.ru) : '')+(ex.set ? ' · '+diagSetLabel(ex.set) : '')});
    if (fi && fi.hint) steps.push({k:'check', t:T(fi.hint.de, fi.hint.ru)});
  }
  if (a && a.t){
    a.t.steps.forEach(function(x){ steps.push({k:'check', t:x}); });
    a.t.chapters.forEach(function(c){ if (byId[c.id]) steps.push({k:'comp', ch:c.id, why:c.why, kind:c.kind}); });
  } else {
    steps.push({k:'check', t:T('Herstellerdaten (HaynesPro) zum Code und Schaltplan holen.','Взять данные производителя (HaynesPro) по коду и схему.')});
    steps.push({k:'check', t:T('Freeze Frame und Istwerte des betroffenen Systems lesen.','Прочитать стоп-кадр и живые данные затронутой системы.')});
    steps.push({k:'comp', ch:'k119', why:T('Leitung, Masse und Steuergeräte-Pin prüfen.','Проверить провод, массу и контакт блока.'), kind:'Grundlage'});
  }
  steps.push({k:'end'});
  steps.forEach(function(x){ x.st = ''; x.note = ''; x.mess = []; });
  return {code:code, set:set||'manual', steps:steps, si:0, done:false, cause:'', desc:(ex&&ex.desc)||'', ftb:(ex&&ex.ftb)||'', modul:(ex&&ex.module)||''};
}
function diagStart(list, src, opts){
  var seen = {}, codes = [];
  list.forEach(function(x){ if (!seen[x.code]) { seen[x.code] = 1; codes.push(diagBuild(x.code, x.set, x)); } });
  codes.sort(function(a,b){ var ra = diagRank(a), rb = diagRank(b); for (var i=0;i<3;i++) if (ra[i]!==rb[i]) return ra[i]-rb[i]; return a.code.localeCompare(b.code); });
  state.diag = {id:newId(), started:new Date().toISOString(), src:src, car:(opts && opts.car ? opts.car : (obd && obd.io ? obd.name+(obd.info?' · '+obd.info.name:'') : '')), codes:codes, ci:0, sel:true, fz:vehToFz(src==='OBD' && obd.veh ? obd.veh : null, state.fzNext || {kz:'', marke:'', modell:'', vin:'', km:'', kunde:'', tel:''})};
  state.fzNext = null;
  diagSave(); go('diag');
}
function stepHas(x){ return !!(x.st || x.note || (x.mess && x.mess.length)); }
function inRep(D0, x){ if (x.k==='end') return false; return D0.sel ? !!x.rep : stepHas(x); }
function diagSaveAny(D0){ if (state.diag && D0.id===state.diag.id) { diagSave(); return; } archivSave(); if (cloudArch) cloudArch.doc(D0.id).set(JSON.parse(JSON.stringify(D0))).catch(function(){}); }
function diagSetLabel(set){ return {active:T('aktiv','активный'), stored:T('gespeichert','сохранённый'), pending:T('anstehend','ожидающий'), permanent:T('permanent','постоянный'), uds:'UDS', manual:T('manuell','вручную')}[set] || set; }
function diagExtra(x, it){
  var h = '<aside class="dg-extra">';
  if (obd && obd.io) {
    h += '<div class="mess"><b>'+T('Live-Daten','Живые данные')+'</b>' + (obd.live.length ? '<div class="live-grid mini">'+obd.live.slice(0,6).map(function(r){ return '<div class="live'+(r.warn?' warn':'')+'"><span class="lbl">'+esc(r.label)+'</span><b>'+esc(r.text)+'</b></div>'; }).join('')+'</div>' : '<p class="meta">'+T('Auf der OBD-Seite „Live-Daten“ starten.','Запусти «Живые данные» на странице OBD.')+'</p>') + '</div>';
  } else {
    h += '<div class="mess"><b>'+T('Live-Daten','Живые данные')+'</b><p class="meta">'+T('Kein Adapter verbunden.','Адаптер не подключён.')+' <a href="#obd">OBD</a></p></div>';
  }
  if (it) {
    var kinds = OSZ.map[it.id] || [];
    if (kinds.length) { var w = OSZ.waves[kinds[0]], t = state.lang==='ru' ? w.ru : w.de; h += '<div class="mess"><b>'+esc(t.n)+'</b>'+scopeSvg(kinds[0])+'<span class="meta">'+esc(t.set)+'</span></div>'; }
    if (it.ov && it.ov.length) h += '<div class="mess"><b>'+T('Aus dem Kapitel','Из главы')+'</b>'+it.ov.slice(0,4).map(function(r){ return '<div class="meta"><b>'+esc(r[0])+':</b> '+esc(r[1])+'</div>'; }).join('')+'<a href="#b-'+it.id+'">'+T('Kapitel öffnen →','Открыть главу →')+'</a></div>';
  } else {
    h += '<div class="mess"><b>'+T('Hinweis','Подсказка')+'</b><p class="meta">'+T('Bei Bauteil-Schritten erscheinen hier Oszillogramm und Sollwerte.','На шагах-компонентах здесь появятся осциллограмма и нормы.')+'</p></div>';
  }
  return h + '</aside>';
}
function diagStepTitle(x, i){ if (x.k==='end') return T('Abschluss','Итог'); if (x.k==='comp') { var it = byId[x.ch]; return T('Prüfen: ','Проверить: ')+(it?L(it,'title'):x.ch); } return x.t; }
function diagBanner(){
  var D0 = state.diag; if (!D0 || !D0.codes.length) return '';
  var c = D0.codes[D0.ci] || D0.codes[0], open = D0.codes.filter(function(x){return !x.done;}).length;
  return '<a class="diag-banner" href="#diag"><span>← '+T('Zurück zur Diagnose','Назад к диагностике')+'</span><b class="mono">'+esc(c.code)+'</b><span>'+T('Schritt ','Шаг ')+(c.si+1)+'/'+c.steps.length+' · '+open+' '+T('Codes offen','кодов открыто')+'</span></a>';
}
function diagShared(ci){
  var D0 = state.diag, me = D0.codes[ci], mine = me.steps.filter(function(x){return x.k==='comp';}).map(function(x){return x.ch;});
  return D0.codes.filter(function(o,i){ return i!==ci && o.steps.some(function(x){ return x.k==='comp' && x.ch!=='k119' && x.ch!=='k1' && x.ch!=='k120' && mine.indexOf(x.ch)>=0; }); }).map(function(o){ return o.code; });
}
function vDiag(){
  var D0 = state.diag;
  if (!D0 || !D0.codes.length) return '<div class="wrap">'+crumbs([T('Diagnose','Диагностика')])+'<h1>'+T('Geführte Diagnose','Пошаговая диагностика')+'</h1><div class="empty"><p>'+T('Keine Diagnose aktiv. Fehler über OBD lesen oder Codes unter „Fehlercodes“ eingeben und dort „Diagnose starten“ wählen.','Диагностика не запущена. Прочитай ошибки через OBD или введи коды в «Коды ошибок» и нажми «Начать диагностику».')+'</p><div class="btn-row" style="justify-content:center"><a class="btn primary" href="#obd">OBD</a><a class="btn" href="#dtc">'+T('Fehlercodes','Коды ошибок')+'</a></div></div>'+foot()+'</div>';
  var ci = Math.min(D0.ci, D0.codes.length-1), c = D0.codes[ci], a = dtcAdvice(c.code), x = c.steps[c.si], it = x.ch ? byId[x.ch] : null;
  D0.fz = D0.fz || {kz:'', marke:'', modell:'', vin:'', km:'', kunde:'', tel:''};
  var h = '<div class="wrap">'+crumbs([T('Diagnose','Диагностика')])+'<div class="detail-head"><h1>'+T('Geführte Diagnose','Пошаговая диагностика')+'</h1><div class="actions"><button class="btn" id="dgReport">'+T('Bericht','Отчёт')+'</button><button class="btn danger" id="dgEnd">'+T('Abschließen','Завершить')+'</button></div></div>' +
    '<p class="meta">'+(D0.car?esc(D0.car)+' · ':'')+T('gestartet ','начата ')+esc(new Date(D0.started).toLocaleString(state.lang==='ru'?'ru-RU':'de-DE'))+'</p>' + fzForm(D0.fz);
  // Code-Leiste
  h += '<div class="dg-codes" role="tablist">'+D0.codes.map(function(o,i){ var aa = dtcAdvice(o.code), sv = aa&&aa.t ? SEV[aa.t.severity][2] : 'na'; var prog = o.steps.filter(function(s){return s.st;}).length; return '<button role="tab" class="dg-code'+(i===ci?' on':'')+(o.done?' done':'')+'" data-ci="'+i+'" aria-selected="'+(i===ci)+'"><span class="st '+(o.done?'ok':sv)+'">'+(o.done?'✓':(i+1))+'</span><b class="mono">'+esc(o.code)+'</b><small>'+esc(aa&&aa.t?aa.t.title:T('Herstellercode','Код производителя'))+'</small><small>'+diagSetLabel(o.set)+' · '+prog+'/'+(o.steps.length-1)+'</small></button>'; }).join('')+'</div>';
  if (D0.codes.length>1) h += '<p class="note">'+T('Reihenfolge: Spannungs- und Kommunikationsfehler zuerst (lösen oft Folgefehler aus), danach nach Priorität. Jeder Code ist jederzeit anwählbar.','Порядок: сначала ошибки питания и связи (часто вызывают другие ошибки), затем по приоритету. Любой код можно выбрать в любой момент.')+'</p>';
  var sh = diagShared(ci); if (sh.length) h += '<p class="note">'+T('Gemeinsame Bauteile mit ','Общие компоненты с ')+sh.join(', ')+T(' – mögliche gemeinsame Ursache.',' — возможна общая причина.')+'</p>';
  // Code-Kopf
  h += '<div class="dg-grid"><aside class="dg-side"><div class="mess"><b class="mono" style="font-size:var(--text-lg)">'+esc(c.code)+'</b>'+(c.ftb?'<span class="meta mono">'+T('Fehlerart ','Тип ошибки ')+esc(c.ftb)+'</span>':'')+(c.desc?'<span class="meta">'+T('Bericht: ','Отчёт: ')+esc(c.desc)+'</span>':'')+(a&&a.t?'<b>'+esc(a.t.title)+'</b><span class="meta">'+esc(a.t.system)+' · '+T('Priorität ','Приоритет: ')+esc(T(SEV[a.t.severity][0],SEV[a.t.severity][1]))+'</span>'+(a.mirror?'<span class="meta">'+T('Herstellercode, Orientierung an ','Код производителя, ориентир ')+esc(a.mirror)+'</span>':''):'<span class="meta">'+T('Kein genormter Eintrag','Нет стандартной записи')+'</span>')+'</div>' +
    '<p class="meta dg-hint">'+T('☑ = kommt in den Bericht','☑ = попадёт в отчёт')+'</p><ol class="dg-steps">'+c.steps.map(function(s,i){ return '<li class="dg-li">'+(s.k!=='end'?'<input type="checkbox" class="dg-rep" data-rep="'+i+'"'+(inRep(D0,s)?' checked':'')+' aria-label="'+T('In Bericht übernehmen','В отчёт')+'" title="'+T('In Bericht übernehmen','В отчёт')+'">':'<span class="dg-rep-sp"></span>')+'<button class="dg-step'+(i===c.si?' on':'')+' s-'+(s.st||'none')+'" data-si="'+i+'"><span class="dot"></span>'+(s.own?'<span class="badge">'+T('eigen','свой')+'</span> ':'')+esc(diagStepTitle(s,i))+'</button></li>'; }).join('')+'</ol>' +
    '<form id="ownForm" class="own-step"><input id="ownIn" placeholder="'+T('Eigener Prüfschritt, z. B. Stecker G28 gereinigt','Свой шаг, напр. зачистил разъём G28')+'"><button class="btn small" type="submit">+ '+T('Eigener Schritt','Свой шаг')+'</button></form></aside><section class="dg-main">';
  h += '<p class="eyebrow">'+T('Schritt ','Шаг ')+(c.si+1)+' / '+c.steps.length+'</p>';
  if (x.k==='check'){
    h += '<h2>'+esc(x.t)+'</h2><p class="muted">'+T('Ergebnis festhalten und weiter.','Отметь результат и иди дальше.')+'</p>';
  } else if (x.k==='comp'){
    h += '<h2>'+esc(it?L(it,'title'):x.ch)+'</h2><p><span class="badge">'+esc(x.kind)+'</span> '+esc(x.why)+'</p>';
    if (it && it.ov && it.ov.length) h += '<dl class="quick">'+it.ov.slice(0,4).map(function(r,i){ return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd><button class="btn small mbtn" data-dov="'+i+'">→ '+T('messen','замерить')+'</button></div>'; }).join('')+'</dl>';
    var curKey = fzKey(D0.fz), mine = {}; D0.codes.forEach(function(cc){ cc.steps.forEach(function(ss){ (ss.mess||[]).forEach(function(id){ mine[id] = 1; }); }); });
    var prevV = curKey ? vehicles().find(function(v){ return v.key===curKey; }) : null;
    var prev = prevV ? prevV.mess.filter(function(m){ return m.comp===x.ch && !mine[m.id]; }).sort(function(a,b){ return (b.datum||'').localeCompare(a.datum||''); })[0] : null;
    if (prev) { var pj = judge(prev); h += '<p class="note prev-visit"><b>'+T('Früherer Besuch ','Прошлый визит ')+esc(prev.datum ? dateOnly(prev.datum) : '')+':</b> '+esc(prev.punkt||'')+' · '+T('Ist ','факт ')+fmtN(prev.ist)+' '+esc(prev.einheit||'')+' → '+esc(pj.t)+'</p>'; }
    var kinds = OSZ.map[x.ch]||[]; if (kinds.length) h += '<p class="meta">'+T('Oszillogramme: ','Осциллограммы: ')+kinds.map(function(k){ var w = OSZ.waves[k]; return esc(state.lang==='ru'?w.ru.n:w.de.n); }).join(' · ')+'</p>';
    h += '<div class="btn-row"><a class="btn" href="#b-'+esc(x.ch)+'">'+T('Kapitel öffnen','Открыть главу')+'</a><button class="btn primary" id="dgMess">+ '+T('Messung','Замер')+'</button></div>';
    var ms = x.mess.map(function(id){ return state.mess.find(function(m){return m.id===id;}); }).filter(Boolean);
    if (ms.length) { h += '<div class="mess-list">'+ms.map(messCard).join('')+'</div>'; after(bindMessCards); }
  } else {
    var finds = []; c.steps.forEach(function(s){ if (s.st==='nok') finds.push('✗ '+diagStepTitle(s)); else if (s.st==='ok' && s.k==='comp') finds.push('✓ '+diagStepTitle(s)); });
    h += '<h2>'+T('Abschluss für ','Итог по ')+esc(c.code)+'</h2>'+(finds.length?'<ul>'+finds.map(function(f){ return '<li>'+esc(f)+'</li>'; }).join('')+'</ul>':'<p class="muted">'+T('Noch keine Ergebnisse festgehalten.','Результатов пока нет.')+'</p>') +
      '<div class="field wide"><label for="dgCause">'+T('Ursache / Reparatur','Причина / ремонт')+'</label><textarea id="dgCause">'+esc(c.cause)+'</textarea></div>' +
      '<p class="note">'+T('Nach der Reparatur: Fehler löschen, Probefahrt, erneut lesen. Kommt der Code wieder, Diagnose fortsetzen.','После ремонта: стереть ошибки, пробная поездка, прочитать снова. Если код вернулся — продолжить диагностику.')+'</p>' +
      '<div class="btn-row"><button class="btn primary" id="dgDone">'+(c.done?T('Wieder öffnen','Открыть снова'):T('Code erledigt','Код закрыт'))+'</button>'+(obd.io?'<button class="btn danger" id="dgClear">'+T('Fehler löschen (OBD)','Стереть ошибки (OBD)')+'</button>':'')+'</div>';
  }
  if (x.k!=='end'){
    h += '<div class="btn-row dg-res"><button class="btn'+(x.st==='ok'?' primary':'')+'" data-st="ok">✓ '+(x.k==='comp'?T('Bauteil in Ordnung','Компонент исправен'):T('In Ordnung','В порядке'))+'</button><button class="btn danger'+(x.st==='nok'?' on':'')+'" data-st="nok">✗ '+(x.k==='comp'?T('Bauteil defekt / auffällig','Компонент неисправен'):T('Auffällig','Есть отклонение'))+'</button><button class="btn'+(x.st==='skip'?' primary':'')+'" data-st="skip">'+T('Überspringen','Пропустить')+'</button></div>' +
      '<div class="field wide"><label for="dgNote">'+T('Notiz zu diesem Schritt','Заметка к шагу')+'</label><textarea id="dgNote">'+esc(x.note)+'</textarea></div>' +
      '<label class="rep-check"><input type="checkbox" id="dgRepThis"'+(inRep(D0,x)?' checked':'')+'> '+T('Diesen Schritt in den Bericht übernehmen','Включить этот шаг в отчёт')+'</label>';
  }
  h += '<div class="pager dg-nav">'+(c.si>0?'<a href="#diag" id="dgPrev"><small>'+T('Zurück','Назад')+'</small>'+esc(diagStepTitle(c.steps[c.si-1]))+'</a>':(ci>0?'<a href="#diag" id="dgPrevCode"><small>'+T('Vorheriger Code','Предыдущий код')+'</small>'+esc(D0.codes[ci-1].code)+'</a>':'<span></span>')) +
    (c.si<c.steps.length-1?'<a class="next" href="#diag" id="dgNext"><small>'+T('Weiter','Далее')+'</small>'+esc(diagStepTitle(c.steps[c.si+1]))+'</a>':(ci<D0.codes.length-1?'<a class="next" href="#diag" id="dgNextCode"><small>'+T('Nächster Code','Следующий код')+'</small>'+esc(D0.codes[ci+1].code)+'</a>':''))+'</div>';
  h += '</section>' + diagExtra(x, it) + '</div>' + foot() + '</div>';
  after(function(){
    function goStep(ci2, si2){ D0.ci = ci2; if (si2!=null) D0.codes[ci2].si = si2; diagSave(); render(); }
    main.querySelectorAll('[data-ci]').forEach(function(b){ b.onclick = function(){ goStep(+b.dataset.ci); }; });
    main.querySelectorAll('[data-si]').forEach(function(b){ b.onclick = function(){ goStep(ci, +b.dataset.si); }; });
    function ensureSel(){ if (!D0.sel){ D0.codes.forEach(function(cc){ cc.steps.forEach(function(ss){ ss.rep = stepHas(ss); }); }); D0.sel = true; } }
    main.querySelectorAll('[data-rep]').forEach(function(cb){ cb.onchange = function(){ ensureSel(); c.steps[+cb.dataset.rep].rep = cb.checked; diagSave(); var t = $('#dgRepThis'); if (t && +cb.dataset.rep===c.si) t.checked = cb.checked; }; });
    var rt = $('#dgRepThis'); if (rt) rt.onchange = function(){ ensureSel(); x.rep = rt.checked; diagSave(); var cb = main.querySelector('[data-rep="'+c.si+'"]'); if (cb) cb.checked = rt.checked; };
    $('#ownForm').onsubmit = function(e){ e.preventDefault(); var v = $('#ownIn').value.trim(); if (!v) return; ensureSel(); var at = c.steps.length-1; c.steps.splice(at, 0, {k:'check', t:v, own:true, rep:true, st:'', note:'', mess:[]}); diagSave(); goStep(ci, at); };
    var n = $('#dgNote'); if (n) n.oninput = function(){ x.note = n.value; diagSave(); };
    var cz = $('#dgCause'); if (cz) cz.oninput = function(){ c.cause = cz.value; diagSave(); };
    main.querySelectorAll('[data-st]').forEach(function(b){ b.onclick = function(){
      x.st = b.dataset.st; x.at = new Date().toISOString();
      if (x.st==='nok' && x.k==='comp' && !c.cause) c.cause = diagStepTitle(x).replace(/^[^:]+:\s*/,'') + T(' defekt/auffällig',' неисправен');
      diagSave();
      if (x.st==='nok' && x.k==='comp') { toast(T('Mögliche Ursache gefunden → Abschluss','Похоже, причина найдена → итог')); goStep(ci, c.steps.length-1); }
      else if (c.si < c.steps.length-1) goStep(ci, c.si+1); else render(true);
    }; });
    var pv = $('#dgPrev'); if (pv) pv.onclick = function(e){ e.preventDefault(); goStep(ci, c.si-1); };
    var nx = $('#dgNext'); if (nx) nx.onclick = function(e){ e.preventDefault(); goStep(ci, c.si+1); };
    var pc = $('#dgPrevCode'); if (pc) pc.onclick = function(e){ e.preventDefault(); goStep(ci-1); };
    var nc = $('#dgNextCode'); if (nc) nc.onclick = function(e){ e.preventDefault(); goStep(ci+1); };
    var dm = $('#dgMess'); if (dm) dm.onclick = function(){ state.diagRet = {ci:ci, si:c.si}; startDraft({comp:x.ch, notiz:'Diagnose '+c.code}); };
    main.querySelectorAll('[data-dov]').forEach(function(b){ b.onclick = function(){ var r = it.ov[+b.dataset.dov], p = parseSoll(r[1]); state.diagRet = {ci:ci, si:c.si}; startDraft({comp:x.ch, punkt:r[0], solltxt:r[1], lo:p.lo, hi:p.hi, einheit:p.unit, herkunft:1, notiz:'Diagnose '+c.code}); }; });
    var dd = $('#dgDone'); if (dd) dd.onclick = function(){ c.done = !c.done; c.doneAt = c.done ? new Date().toISOString() : ''; diagSave(); if (c.done){ var nxt = D0.codes.findIndex(function(o){ return !o.done; }); if (nxt>=0) { toast(T('Nächster offener Code: ','Следующий открытый код: ')+D0.codes[nxt].code); goStep(nxt); return; } toast(T('Alle Codes erledigt','Все коды закрыты')); } render(true); };
    var dc = $('#dgClear'); if (dc) dc.onclick = function(){ if (!dc.dataset.sure){ dc.dataset.sure = 1; dc.textContent = T('Wirklich löschen? Motor aus, Zündung an','Точно стереть? Мотор стоит, зажигание вкл.'); return; } JCX.clearDtcs(obd.io).then(function(){ toast(T('Fehlerspeicher gelöscht','Память ошибок стёрта')); }, function(e){ toast(e.message); }); };
    var de = $('#dgEnd'); de.onclick = function(){ if (!de.dataset.sure){ de.dataset.sure = 1; de.textContent = T('Abschließen und im Archiv speichern?','Завершить и сохранить в архив?'); return; } var id = diagArchive(); toast(T('Im Archiv „Berichte“ gespeichert','Сохранено в архиве «Отчёты»')); go('bericht-'+id); };
    bindFz(D0);
    $('#dgReport').onclick = function(){ go('diag-bericht'); };
  });
  return h;
}
function dtcMeaning(code){
  var a = dtcAdvice(code); if (!a) return '';
  var grp = {P:T('Antrieb (Motor/Getriebe)','привод (двигатель/КПП)'), C:T('Fahrwerk','ходовая часть'), B:T('Karosserie','кузов'), U:T('Datenbus/Kommunikation','шина данных/связь')}[code[0]];
  var mfr = a.mfr ? T('herstellerspezifischer','заводской') : T('genormter','стандартный');
  if (!a.t) return T('Ein ','Это ')+mfr+T(' Code der Gruppe ',' код группы «')+grp+T('. Ohne genormte Bedeutung – genaue Bezeichnung in den Herstellerdaten (HaynesPro) nachsehen.','». Стандартного значения нет — точное название смотреть в данных производителя (HaynesPro).');
  var range = a.seg[0]===a.seg[1] ? a.seg[0] : a.seg[0]+'–'+a.seg[1];
  return code+T(' ist ein ',' — ')+mfr+T(' Code der Gruppe ',' код группы «')+grp+T('. Thema: ','». Тема: ')+a.t.title+' ('+T('System ','система ')+a.t.system+T(', Codebereich ',', диапазон ')+range+').' + (a.mirror ? T(' Herstellercode – Bedeutung hier am genormten ',' Код производителя — значение дано по стандартному ')+a.mirror+T(' angelehnt, genaue Bezeichnung laut Hersteller prüfen.',', точное название сверить с производителем.') : '');
}
var FZ_FIELDS = [['kz','Kennzeichen','Госномер'],['marke','Marke','Марка'],['modell','Modell / Baujahr','Модель / год'],['vin','VIN','VIN'],['km','Kilometerstand','Пробег, км'],['kunde','Kunde (Name)','Клиент (имя)'],['tel','Telefon','Телефон']];
function fzSummary(fz){ fz = fz || {}; return [fz.kz, [fz.marke, fz.modell].filter(Boolean).join(' '), fz.kunde].filter(Boolean).join(' · '); }
function fzForm(fz){
  var canObd = obd && obd.io && obd.veh && (obd.veh.vin || obd.veh.km);
  var empty = !fzSummary(fz);
  return '<details class="fs fz"'+(empty?' open':'')+'><summary><b>'+T('Fahrzeug und Kunde','Автомобиль и клиент')+'</b> <span class="meta">'+esc(fzSummary(fz)||T('noch nicht eingetragen – für die Suche im Archiv','ещё не заполнено — нужно для поиска в архиве'))+'</span></summary><div class="form-grid">' +
    FZ_FIELDS.map(function(f){ return '<div class="field"><label for="fz_'+f[0]+'">'+T(f[1],f[2])+'</label><input id="fz_'+f[0]+'" data-fz="'+f[0]+'" value="'+esc(fz[f[0]]||'')+'"'+(f[0]==='marke'?' list="dlMarken2"':'')+(f[0]==='km'?' inputmode="numeric"':'')+(f[0]==='tel'?' inputmode="tel"':'')+(f[0]==='kz'?' style="text-transform:uppercase"':'')+'></div>'; }).join('') +
    (canObd ? '<div class="btn-row"><button type="button" class="btn small" id="fzObd">'+T('Aus OBD übernehmen (VIN, Marke, km)','Взять из OBD (VIN, марка, пробег)')+'</button></div>' : '') + '</div><datalist id="dlMarken2">'+X.marken.map(function(m){ return '<option value="'+esc(m)+'">'; }).join('')+'</datalist></details>';
}
function bindFz(D0){
  var fo = $('#fzObd'); if (fo) fo.onclick = function(){ D0.fz = vehToFz(obd.veh, D0.fz); diagSave(); toast(T('Fahrzeugdaten übernommen','Данные машины взяты')); render(true); }; main.querySelectorAll('[data-fz]').forEach(function(e){ e.oninput = function(){ var v = e.value; if (e.dataset.fz==='kz') v = v.toUpperCase(); D0.fz[e.dataset.fz] = v; diagSave(); }; }); }
function fzHead(D0){
  var fz = D0.fz || {};
  if (!fzSummary(fz) && !fz.vin) return '';
  return '<dl class="quick rep-head">' + FZ_FIELDS.filter(function(f){ return fz[f[0]]; }).map(function(f){ return '<div><dt>'+T(f[1],f[2])+'</dt><dd>'+(f[0]==='kz'?'<span class="kz">'+esc(fz[f[0]])+'</span>':esc(fz[f[0]])+(f[0]==='km'?' km':''))+'</dd></div>'; }).join('') + '</dl>';
}
function diagArchive(){
  var D0 = state.diag; if (!D0) return null;
  D0.ended = new Date().toISOString();
  var copy = JSON.parse(JSON.stringify(D0));
  state.archiv = state.archiv.filter(function(r){ return r.id!==copy.id; }); state.archiv.unshift(copy); archivSave();
  if (cloudArch) cloudArch.doc(copy.id).set(copy).catch(function(){});
  state.diag = null; diagSave();
  return copy.id;
}
function archDel(id){ state.archiv = state.archiv.filter(function(r){ return r.id!==id; }); archivSave(); if (cloudArch) cloudArch.doc(id).delete().catch(function(){}); }
function vBerichte(){
  var q = state.berQ || '', sort = state.berS || 'datum';
  var list = state.archiv.slice();
  if (state.diag) list.unshift(Object.assign({}, state.diag, {_active:true}));
  var hay = function(r){ var fz = r.fz||{}; return norm([fz.kz, (fz.kz||'').replace(/[\s-]/g,''), fz.marke, fz.modell, fz.vin, fz.kunde, fz.tel, r.car].concat(r.codes.map(function(c){ return c.code+' '+(c.cause||''); })).join(' ')); };
  var shown = list.filter(function(r){ return !q || norm(q).split(/\s+/).filter(Boolean).every(function(w){ return hay(r).indexOf(w)>=0; }); });
  var key = {datum:function(r){ return r.ended||r.started; }, kz:function(r){ return ((r.fz||{}).kz||'~').toUpperCase(); }, modell:function(r){ var f = r.fz||{}; return ((f.marke||'')+' '+(f.modell||'')).trim().toLowerCase()||'~'; }, kunde:function(r){ return ((r.fz||{}).kunde||'~').toLowerCase(); }}[sort];
  shown.sort(function(a,b){ if (a._active) return -1; if (b._active) return 1; return sort==='datum' ? key(b).localeCompare(key(a)) : (key(a).localeCompare(key(b)) || (b.started||'').localeCompare(a.started||'')); });
  var loc = state.lang==='ru'?'ru-RU':'de-DE';
  var h = '<div class="wrap">'+crumbs([T('Berichte','Отчёты')])+'<h1>'+T('Diagnoseberichte','Отчёты по диагностике')+'</h1><p class="lead">'+T('Alle abgeschlossenen Diagnosen. Suchen nach Kennzeichen, Fahrzeug, Kunde, VIN oder Fehlercode.','Все завершённые диагностики. Поиск по госномеру, машине, клиенту, VIN или коду ошибки.')+'</p>' +
    '<div class="filterbar"><input id="berQ" type="search" value="'+esc(q)+'" placeholder="'+T('z. B. F-AB 123, Golf, Müller, P0301','напр. F-AB 123, Golf, Иванов, P0301')+'"><select id="berS" aria-label="'+T('Sortierung','Сортировка')+'">' +
    [['datum',T('Neueste zuerst','Сначала новые')],['kz',T('Kennzeichen A–Z','Госномер А–Я')],['modell',T('Marke / Modell A–Z','Марка / модель А–Я')],['kunde',T('Kunde A–Z','Клиент А–Я')]].map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===sort?' selected':'')+'>'+o[1]+'</option>'; }).join('') + '</select><span class="muted">'+shown.length+' / '+list.length+'</span></div>';
  if (!list.length) h += '<div class="empty"><p>'+T('Noch keine Berichte. Eine Diagnose mit „Abschließen“ beenden – sie landet hier.','Отчётов пока нет. Заверши диагностику кнопкой «Завершить» — она появится здесь.')+'</p><a class="btn primary" href="#obd">OBD</a></div>';
  var lastGroup = null;
  h += '<div class="ber-list">' + shown.map(function(r){
    var fz = r.fz||{}, nDone = r.codes.filter(function(c){return c.done;}).length, causes = r.codes.map(function(c){ return c.cause; }).filter(Boolean);
    var grp = sort==='kz' ? (fz.kz||T('ohne Kennzeichen','без номера')) : sort==='modell' ? ([fz.marke, fz.modell].filter(Boolean).join(' ')||T('ohne Fahrzeugangabe','без данных машины')) : sort==='kunde' ? (fz.kunde||T('ohne Kunde','без клиента')) : null;
    var gh = (grp!==null && grp!==lastGroup && !r._active) ? '<h3 class="ber-grp">'+esc(grp)+'</h3>' : ''; if (!r._active) lastGroup = grp;
    return gh + '<article class="ber'+(r._active?' active':'')+'"><div class="ber-top">'+(fz.kz?'<span class="kz">'+esc(fz.kz)+'</span>':'')+'<b>'+esc([fz.marke, fz.modell].filter(Boolean).join(' ')||T('Fahrzeug ohne Angabe','Машина не указана'))+'</b>'+(fz.kunde?'<span class="meta">'+esc(fz.kunde)+(fz.tel?' · '+esc(fz.tel):'')+'</span>':'')+'<span class="meta ber-date">'+(r._active?'<span class="st na">'+T('läuft','идёт')+'</span> ':'')+esc(new Date(r.ended||r.started).toLocaleDateString(loc))+'</span></div>' +
      '<div class="ber-codes">'+r.codes.map(function(c){ return '<span class="st '+(c.done?'ok':'hi')+'"><span class="mono">'+esc(c.code)+'</span></span>'; }).join(' ')+' <span class="meta">'+nDone+'/'+r.codes.length+' '+T('erledigt','закрыто')+(fz.km?' · '+esc(fz.km)+' km':'')+(fz.vin?' · VIN '+esc(fz.vin):'')+'</span></div>' +
      (causes.length?'<p class="ber-cause">'+esc(causes.join(' · '))+'</p>':'') +
      '<div class="btn-row" style="margin:6px 0 0">' + (r._active ? '<a class="btn small primary" href="#diag">'+T('Fortsetzen','Продолжить')+'</a><a class="btn small" href="#diag-bericht">'+T('Bericht','Отчёт')+'</a>' :
        '<a class="btn small primary" href="#bericht-'+esc(r.id)+'">'+T('Bericht öffnen','Открыть отчёт')+'</a>'+(fzKey(r.fz)?'<a class="btn small" href="#fz-'+fzKey(r.fz)+'">'+T('Fahrzeugakte','Карточка машины')+'</a>':'')+'<button class="btn small" data-reopen="'+esc(r.id)+'">'+T('Wieder aufnehmen','Продолжить диагностику')+'</button><button class="btn small" data-again="'+esc(r.id)+'">'+T('Neue Diagnose, gleiches Fahrzeug','Новая диагностика этой машины')+'</button><button class="btn small danger" data-adel="'+esc(r.id)+'">'+T('Löschen','Удалить')+'</button>') + '</div></article>';
  }).join('') + '</div>';
  h += '<p class="muted" style="font-size:var(--text-xs)">'+T('Kundendaten bleiben in deinem Browser bzw. in deinem privaten Bereich der veröffentlichten App und sind im Backup enthalten.','Данные клиентов хранятся в твоём браузере или в твоей личной части опубликованного приложения и входят в резервную копию.')+'</p>' + foot() + '</div>';
  after(function(){
    var qi = $('#berQ'); qi.addEventListener('input', function(){ state.berQ = qi.value; clearTimeout(qi.t); qi.t = setTimeout(function(){ render(true); var n = $('#berQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    $('#berS').onchange = function(){ state.berS = this.value; render(true); };
    main.querySelectorAll('[data-adel]').forEach(function(b){ b.onclick = function(){ if (!b.dataset.sure){ b.dataset.sure = 1; b.textContent = T('Wirklich löschen?','Точно удалить?'); return; } archDel(b.dataset.adel); render(true); }; });
    main.querySelectorAll('[data-reopen]').forEach(function(b){ b.onclick = function(){ if (state.diag){ toast(T('Erst die laufende Diagnose abschließen','Сначала заверши текущую диагностику')); return; } var r = state.archiv.find(function(x){ return x.id===b.dataset.reopen; }); if (!r) return; state.diag = JSON.parse(JSON.stringify(r)); delete state.diag.ended; archDel(r.id); diagSave(); go('diag'); }; });
    main.querySelectorAll('[data-again]').forEach(function(b){ b.onclick = function(){ var r = state.archiv.find(function(x){ return x.id===b.dataset.again; }); if (!r) return; state.fzNext = JSON.parse(JSON.stringify(r.fz||{})); state.fzNext.km = ''; toast(T('Fahrzeugdaten übernommen – jetzt Fehler lesen oder Codes eingeben','Данные машины взяты — теперь прочитай ошибки или введи коды')); go('obd'); }; });
  });
  return h;
}

function vDiagReport(D0, archived){
  D0 = D0 || state.diag;
  if (!D0) return vDiag();
  var loc = state.lang==='ru'?'ru-RU':'de-DE', tm = function(iso){ return iso ? new Date(iso).toLocaleDateString(loc, {day:'2-digit', month:'2-digit', year:'numeric'}) : ''; };
  var nDone = D0.codes.filter(function(c){return c.done;}).length;
  var h = '<div class="wrap rep">'+crumbs(['<a href="#diag">'+T('Diagnose','Диагностика')+'</a>', T('Bericht','Отчёт')])+
    '<div class="detail-head"><h1>'+T('Diagnosebericht','Отчёт по диагностике')+'</h1><div class="actions"><button class="btn'+(state.repEdit?' primary':'')+'" id="rEdit">'+(state.repEdit?T('Auswahl fertig','Готово'):T('Schritte auswählen','Выбрать шаги'))+'</button><button class="btn" id="rCopy">'+T('Als Text kopieren','Копировать текстом')+'</button>'+(archived ? '<a class="btn primary" href="#berichte">← '+T('Alle Berichte','Все отчёты')+'</a>' : '<a class="btn primary" href="#diag">← '+T('Zur Diagnose','К диагностике')+'</a>')+'</div></div>' +
    fzHead(D0) + '<dl class="quick rep-head"><div><dt>'+T('Adapter','Адаптер')+'</dt><dd>'+esc(D0.car||T('manuelle Eingabe','ручной ввод'))+'</dd></div><div><dt>'+T('Datum','Дата')+'</dt><dd>'+esc(tm(D0.started))+'</dd></div><div><dt>'+T('Fehlercodes','Кодов ошибок')+'</dt><dd>'+D0.codes.length+' · '+nDone+' '+T('erledigt','закрыто')+'</dd></div></dl>';
  D0.codes.forEach(function(c, ci){
    var a = dtcAdvice(c.code), t = a && a.t, sv = t ? SEV[t.severity] : ['','','na'];
    var edit = !!state.repEdit, did = c.steps.filter(function(x){ return x.k!=='end' && (edit ? true : inRep(D0, x)); });
    var open = (edit || D0.sel) ? [] : c.steps.filter(function(x){ return x.k!=='end' && !stepHas(x); });
    var cause = c.cause || (c.steps.find(function(x){ return x.st==='nok' && x.k==='comp'; }) ? diagStepTitle(c.steps.find(function(x){ return x.st==='nok' && x.k==='comp'; })).replace(/^[^:]+:\s*/,'') : '');
    h += '<article class="rep-code"><header class="rep-ch"><div class="rep-code-id"><span class="mono">'+esc(c.code)+'</span><span class="st '+(c.done?'ok':sv[2])+'">'+(c.done?T('erledigt','закрыт'):T('offen','открыт'))+'</span></div><div><h2>'+esc(t?t.title:T('Herstellerspezifischer Code','Код производителя'))+'</h2><p class="meta">'+(t?esc(t.system)+' · '+T('Priorität ','Приоритет: ')+esc(T(sv[0],sv[1]))+' · ':'')+esc(diagSetLabel(c.set))+(a&&a.mirror?' · '+T('Orientierung an ','ориентир по ')+esc(a.mirror):'')+'</p></div></header>';
    h += '<section class="rep-sec"><h3>'+T('Was bedeutet der Code','Что означает код')+'</h3><p>'+esc(dtcMeaning(c.code))+'</p></section>';
    h += '<section class="rep-sec"><h3>'+T('Was wurde gemacht','Что было сделано')+'</h3>';
    if (!did.length) h += '<p class="muted">'+T('Keine Schritte für den Bericht ausgewählt. Oben „Schritte auswählen“ oder in der Diagnose ☑ setzen.','Шаги для отчёта не выбраны. Нажми «Выбрать шаги» вверху или поставь ☑ в диагностике.')+'</p>';
    else h += '<ol class="rep-tl">'+did.map(function(x){
      var mk = {ok:['ok','✓',T('in Ordnung','в порядке')], nok:['nok','✗',T('auffällig / defekt','отклонение / неисправно')], skip:['skip','–',T('übersprungen','пропущено')]}[x.st] || ['none','·',T('in Arbeit','в работе')];
      var ms = x.mess.map(function(id){ return state.mess.find(function(m){return m.id===id;}); }).filter(Boolean);
      var si = c.steps.indexOf(x);
      return '<li class="tl-'+mk[0]+(edit && !inRep(D0,x)?' tl-off':'')+'">'+(edit?'<input type="checkbox" class="dg-rep" data-rci="'+ci+'" data-rsi="'+si+'"'+(inRep(D0,x)?' checked':'')+'>':'<span class="tl-dot">'+mk[1]+'</span>')+'<div><b>'+esc(diagStepTitle(x))+'</b> <span class="meta">'+esc(mk[2])+(x.at?' · '+esc(tm(x.at)):'')+'</span>' +
        (x.note?'<p class="rep-note">'+esc(x.note)+'</p>':'') +
        ms.map(function(m){ var j = judge(m); return '<div class="rep-m"><span>'+esc(m.punkt||T('Messung','Замер'))+(m.mittel?' · '+esc(T(m.mittel, (MITTEL.find(function(q){return q[0]===m.mittel;})||[0,m.mittel])[1])):'')+'</span><span class="mono">'+T('Soll ','Норма ')+fmtN(m.lo)+' … '+fmtN(m.hi)+' '+esc(m.einheit||'')+' · '+T('Ist ','Факт ')+'<b>'+fmtN(m.ist)+' '+esc(m.einheit||'')+'</b></span><span class="st '+j.c+'">'+esc(j.t)+'</span>'+(m.photos&&m.photos.length?photoThumbs(m.photos,false):'')+'</div>'; }).join('') + '</div></li>';
    }).join('')+'</ol>';
    if (open.length && !c.done) h += '<details class="meta" style="margin-top:8px"><summary>'+T('Noch nicht geprüft: ','Ещё не проверено: ')+open.length+'</summary><ul>'+open.map(function(x){ return '<li>'+esc(diagStepTitle(x))+'</li>'; }).join('')+'</ul></details>';
    h += '</section><section class="rep-sec rep-res"><h3>'+T('Ergebnis','Результат')+'</h3><p>'+(cause?'<b>'+esc(cause)+'</b>':'<span class="muted">'+T('Ursache noch nicht festgelegt.','Причина пока не определена.')+'</span>')+'</p>'+(c.done&&c.doneAt?'<p class="meta">'+T('Abgeschlossen ','Закрыт ')+esc(tm(c.doneAt))+'</p>':'')+''+(archived ? '' : '<a class="btn small" href="#diag" data-goci="'+ci+'">'+T('Diesen Code in der Diagnose öffnen','Открыть код в диагностике')+'</a>')+'</section></article>';
  });
  h += foot() + '</div>';
  after(function(){
    D0.codes.forEach(function(c){ c.steps.forEach(function(x){ x.mess.forEach(function(id){ var m = state.mess.find(function(q){return q.id===id;}); if (m && m.photos) fillThumbs(main, m.photos); }); }); });
    $('#rEdit').onclick = function(){ state.repEdit = !state.repEdit; render(true); };
    main.querySelectorAll('[data-rci]').forEach(function(cb){ cb.onchange = function(){ if (!D0.sel){ D0.codes.forEach(function(cc){ cc.steps.forEach(function(ss){ ss.rep = stepHas(ss); }); }); D0.sel = true; } D0.codes[+cb.dataset.rci].steps[+cb.dataset.rsi].rep = cb.checked; diagSaveAny(D0); cb.closest('li').classList.toggle('tl-off', !cb.checked); }; });
    main.querySelectorAll('[data-goci]').forEach(function(a){ a.onclick = function(e){ e.preventDefault(); D0.ci = +a.dataset.goci; diagSave(); go('diag'); }; });
    $('#rCopy').onclick = function(){ copyText(diagReport(D0)); };
  });
  return h;
}
function diagReport(D0){
  D0 = D0 || state.diag; var L0 = [], loc = state.lang==='ru'?'ru-RU':'de-DE', fz = D0.fz || {};
  L0.push('JC Diagnose – '+T('Diagnosebericht','Отчёт по диагностике'));
  var fzl = [fz.kz, [fz.marke, fz.modell].filter(Boolean).join(' '), fz.vin?'VIN '+fz.vin:'', fz.km?fz.km+' km':''].filter(Boolean).join(' · '); if (fzl) L0.push(T('Fahrzeug: ','Автомобиль: ')+fzl);
  if (fz.kunde || fz.tel) L0.push(T('Kunde: ','Клиент: ')+[fz.kunde, fz.tel].filter(Boolean).join(' · '));
  L0.push(new Date(D0.started).toLocaleDateString(loc, {day:'2-digit', month:'2-digit', year:'numeric'})+(D0.car?' · '+D0.car:'')); L0.push('');
  D0.codes.forEach(function(c){ var a = dtcAdvice(c.code), t = a && a.t;
    L0.push('■ '+c.code+' – '+(t?t.title:T('Herstellercode','Код производителя'))+' ['+(c.done?T('erledigt','закрыт'):T('offen','открыт'))+']');
    L0.push('  '+T('Bedeutung: ','Значение: ')+dtcMeaning(c.code));
    L0.push('  '+T('Gemacht:','Сделано:'));
    var any = false;
    c.steps.forEach(function(s){ if (!inRep(D0, s)) return; any = true; var mk = {ok:'✓', nok:'✗', skip:'–'}[s.st]||'·';
      L0.push('   '+mk+' '+diagStepTitle(s)+(s.note?' — '+s.note:''));
      s.mess.forEach(function(id){ var m = state.mess.find(function(q){return q.id===id;}); if (m) L0.push('       '+(m.punkt||T('Messung','Замер'))+': '+T('Ist ','факт ')+fmtN(m.ist)+' '+(m.einheit||'')+' / '+T('Soll ','норма ')+fmtN(m.lo)+'…'+fmtN(m.hi)+' → '+judge(m).t+((m.photos||[]).length?' ('+m.photos.length+' '+T('Fotos','фото')+')':'')); }); });
    if (!any) L0.push('   –');
    L0.push('  '+T('Ergebnis: ','Результат: ')+(c.cause||T('Ursache noch offen','причина не определена'))); L0.push(''); });
  return L0.join('\n');
}


/* ---------- Bericht importieren (andere Diagnosegeräte) ---------- */
var imp = {res:null, items:[], sel:{}, busy:'', err:'', file:'', txt:'', lang:'deu+eng', ocr:false};
var IMP_ST = {active:['aktiv','активный','hi'], pending:['anstehend','ожидающий','na'], permanent:['permanent','постоянный','hi'], stored:['gespeichert','сохранённый','ok']};
function impDone(res, name){
  imp.busy = ''; imp.file = name || '';
  if (!res || !res.codes || !res.codes.length){ imp.res = null; imp.items = []; imp.err = T('Keine Fehlercodes gefunden. Ist es ein Bericht mit Codes wie P0301, C0035, B1234, U0100? Bei Fotos oder gescannten PDFs den Text hier einfügen.','Коды ошибок не найдены. Это отчёт с кодами вроде P0301, C0035, B1234, U0100? Для фото и сканов вставь текст вручную.'); render(true); return; }
  var rank = {active:0, pending:1, permanent:2, stored:3};
  imp.res = res; imp.err = ''; imp.ocr = !!res.ocr; if (res.text) imp.txt = res.text;
  imp.items = res.codes.map(function(c,i){ c.i = i; return c; }).sort(function(a,b){ return (rank[a.status]-rank[b.status]) || (a.i-b.i); });
  imp.sel = {}; imp.items.forEach(function(c){ imp.sel[c.code] = true; });
  render(true);
}
function impFail(e){ imp.busy = ''; imp.err = (e && e.message) || String(e); render(true); }
function impProgress(st, p, done, total){
  var n = $('#impBusy'); if (!n) return;
  var map = {'loading tesseract core':T('Texterkennung wird geladen …','Загружается распознавание …'), 'loading language traineddata':T('Sprachdaten werden geladen …','Загружаются данные языка …'), 'initializing api':T('Starte …','Запуск …'), 'recognizing text':T('Text wird erkannt','Распознаю текст')};
  n.textContent = (map[st] || T('Texterkennung …','Распознавание …')) + (st==='recognizing text' ? ' ' + Math.round(p*100) + ' %' + (total>1 ? ' ('+(done+1)+'/'+total+')' : '') : '');
}
function impOcr(sources, name){
  imp.busy = T('Texterkennung wird vorbereitet …','Готовлю распознавание …'); imp.err = ''; render(true);
  return JCREP.fromImages(sources, imp.lang, impProgress).then(function(r){ impDone(r, name); }, impFail);
}
function impLoad(file){
  if (!file || !window.JCREP) return;
  imp.busy = T('Lese Bericht …','Читаю отчёт …'); imp.err = ''; render(true);
  var rd = new FileReader(), name = file.name || '';
  if (/\.pdf$/i.test(name) || file.type === 'application/pdf'){
    rd.onload = function(){
      var buf = rd.result;
      JCREP.fromPdf(buf.slice(0)).then(function(r){
        if (r.codes && r.codes.length) { impDone(r, name); return; }
        imp.busy = T('Kein Text im PDF, lese als Scan …','В PDF нет текста, читаю как скан …'); render(true);
        return JCREP.pdfCanvases(buf, 6).then(function(cv){ return impOcr(cv, name); });
      }).catch(impFail);
    };
    rd.onerror = function(){ impFail(new Error(T('Datei nicht lesbar.','Файл не читается.'))); };
    rd.readAsArrayBuffer(file);
  } else if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|bmp|gif)$/i.test(name)){
    impOcr([file], name);
  } else if (/\.(heic|heif)$/i.test(name)){
    impFail(new Error(T('HEIC-Fotos kann der Browser nicht öffnen. Foto als JPG speichern oder direkt mit der Kamera-Taste aufnehmen.','HEIC-фото браузер не открывает. Сохрани как JPG или сними кнопкой «Камера».')));
  } else {
    rd.onload = function(){
      var t = String(rd.result||'');
      if (/\.html?$/i.test(name) || /<html|<table/i.test(t.slice(0,600))) t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi,' ').replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi,'\n').replace(/<\/t[dh]>/gi,'  ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
      impDone(JCREP.parseText(t), name);
    };
    rd.onerror = function(){ impFail(new Error(T('Datei nicht lesbar.','Файл не читается.'))); };
    rd.readAsText(file);
  }
}
function impFz(fz){
  fz = fz || {};
  return {kz:fz.kz||'', marke:fz.marke||'', modell:[fz.modell, fz.jahr ? '('+fz.jahr+')' : ''].filter(Boolean).join(' '), vin:fz.vin||'', km:fz.km||'', kunde:'', tel:''};
}
function vImport(){
  var ok = !!window.JCREP;
  var h = '<div class="wrap">'+crumbs([T('Bericht importieren','Импорт отчёта')])+'<h1>'+T('Bericht importieren','Импорт отчёта')+'</h1><p class="lead">'+T('Bericht eines anderen Diagnosegeräts (Launch, Autel, Bosch, Foxwell, Thinkdiag …) einlesen: Fahrzeug, Fehlercodes und Zustand werden übernommen, dazu gibt es die Prüfreihenfolge und die geführte Diagnose.','Загрузи отчёт другого диагностического прибора (Launch, Autel, Bosch, Foxwell, Thinkdiag …): машина, коды ошибок и их состояние подтянутся, плюс порядок проверки и пошаговая диагностика.')+'</p>';
  h += '<fieldset class="fs"><legend>'+T('Bericht laden','Загрузить отчёт')+'</legend><div class="form-grid"><div class="field wide"><label for="impFile">'+T('Datei (PDF, Foto, Scan, TXT, CSV, HTML)','Файл (PDF, фото, скан, TXT, CSV, HTML)')+'</label><input id="impFile" type="file" accept=".pdf,.txt,.csv,.htm,.html,.log,.json,.xml,image/*,application/pdf,text/*"></div>' +
    '<div class="field"><label for="impCam">'+T('Foto aufnehmen','Снять фото')+'</label><input id="impCam" type="file" accept="image/*" capture="environment"></div>' +
    '<div class="field"><label for="impLang">'+T('Sprache des Berichts (für Fotos)','Язык отчёта (для фото)')+'</label><select id="impLang"><option value="deu+eng"'+(imp.lang==='deu+eng'?' selected':'')+'>Deutsch / English</option><option value="eng"'+(imp.lang==='eng'?' selected':'')+'>English</option><option value="rus+eng"'+(imp.lang==='rus+eng'?' selected':'')+'>Русский / English</option></select></div>' +
    '<div class="field wide"><label for="impTxt">'+T('… oder Text des Berichts einfügen','… или вставь текст отчёта')+'</label><textarea id="impTxt" rows="'+(imp.txt?'9':'4')+'" placeholder="P0301 Zylinder 1 Fehlzündung aktiv&#10;U0100 ...">'+esc(imp.txt)+'</textarea></div></div>' +
    '<div class="btn-row"><button class="btn primary" id="impGo"'+(ok?'':' disabled')+'>'+T('Text auswerten','Разобрать текст')+'</button></div></fieldset>';
  if (imp.busy) h += '<p class="note" id="impBusy">'+esc(imp.busy)+'</p>';
  if (imp.err) h += '<div class="callout hv"><b>'+T('Fehler','Ошибка')+'</b><p>'+esc(imp.err)+'</p></div>';
  if (imp.res && imp.ocr) h += '<div class="callout hv"><b>'+T('Aus dem Bild gelesen','Прочитано с изображения')+'</b><p>'+T('Die Texterkennung verwechselt gelegentlich Zeichen (0/O, 1/I, 8/B, 5/S). Codes, Zustand und Beschreibung bitte mit dem Bild vergleichen; der erkannte Text steht oben und lässt sich korrigieren, dann „Text auswerten“.','Распознавание иногда путает символы (0/O, 1/I, 8/B, 5/S). Сверь коды, состояние и описание с изображением; распознанный текст выше можно поправить и нажать «Разобрать текст».')+'</p></div>';
  if (imp.res){
    var r = imp.res, fz = r.fz || {}, n = imp.items.filter(function(c){ return imp.sel[c.code]; }).length;
    var rows = [[T('Marke','Марка'),fz.marke],[T('Modell','Модель'),fz.modell],[T('Modelljahr','Модельный год'),fz.jahr],['VIN',fz.vin],[T('Motor','Двигатель'),fz.motor],[T('Kilometerstand','Пробег'),fz.km],[T('Prüfzeit','Время проверки'),fz.datum],[T('Software','ПО'),fz.sw],[T('Steuergerät','Блок'),(imp.items[0]||{}).module],[T('Gerät','Прибор'),fz.geraet]].filter(function(x){ return x[1]; });
    h += '<h2>'+T('Fahrzeug laut Bericht','Автомобиль по отчёту')+'</h2><div class="mess"><dl class="quick">'+rows.map(function(x){ return '<div><dt>'+esc(x[0])+'</dt><dd'+(x[0]==='VIN'?' class="mono"':'')+'>'+esc(x[1])+'</dd></div>'; }).join('')+'</dl>'+(imp.file?'<p class="meta">'+esc(imp.file)+'</p>':'')+'</div>';
    var ins = JCREP.insights(imp.items);
    if (ins.length) h += '<h2>'+T('Gesamtbild: was zuerst','Общая картина: что сначала')+'</h2>' + ins.map(function(x){ return '<div class="callout"><b>'+esc(T(x.t[0],x.t[1]))+'</b><p>'+esc(T(x.de,x.ru))+'</p></div>'; }).join('');
    var act = imp.items.filter(function(c){ return c.status==='active'; }).length;
    h += '<h2>'+T('Fehlercodes','Коды ошибок')+' ('+imp.items.length+(act?' · '+act+' '+T('aktiv','активных'):'')+')</h2><div class="mess-list">' + imp.items.map(function(c,i){
      var a = dtcAdvice(c.code), st = IMP_ST[c.status] || IMP_ST.stored, fi = c.ftb ? JCREP.ftbInfo(c.ftb) : null;
      var db = a && a.t ? esc(a.t.title)+' · '+esc(a.t.system)+' · '+T('Priorität ','Приоритет: ')+esc(T(SEV[a.t.severity][0],SEV[a.t.severity][1])) : (a && a.mfr ? T('Herstellercode: keine genormte Entsprechung, Herstellerdaten (HaynesPro) nötig.','Код производителя: нет стандартного аналога, нужны данные производителя (HaynesPro).') : T('kein Eintrag in der Datenbank','нет записи в базе'));
      return '<label class="mess imp-row"><div class="r1"><span><input type="checkbox" data-ic="'+esc(c.code)+'"'+(imp.sel[c.code]?' checked':'')+'> <b class="mono" style="font-size:var(--text-lg)">'+esc(c.code)+(c.ftb?'-'+esc(c.ftb):'')+'</b></span><span class="st '+st[2]+'">'+esc(T(st[0],st[1]))+'</span></div>' +
        (c.desc?'<p style="margin:4px 0">'+esc(c.desc)+'</p>':'') + (fi?'<p class="meta">'+T('Fehlerart ','Тип ошибки ')+esc(c.ftb)+': '+esc(T(fi.de,fi.ru))+'</p>':'') + '<p class="meta">'+db+'</p></label>';
    }).join('') + '</div>';
    h += '<div class="callout"><b>'+T('Diagnose','Диагностика')+'</b><p>'+T('Die gewählten Codes Schritt für Schritt abarbeiten: erst aktive Codes, mit den Angaben aus dem Bericht, den Prüfschritten und Kapiteln.','Пройти выбранные коды по шагам: сначала активные, с данными из отчёта, проверками и главами.')+'</p><button class="btn primary" id="impDiag"'+(n?'':' disabled')+'>'+T('Geführte Diagnose starten','Начать пошаговую диагностику')+' ('+n+')</button></div>';
  }
  h += foot() + '</div>';
  after(function(){
    var f = $('#impFile'); if (f) f.onchange = function(){ if (f.files && f.files[0]) impLoad(f.files[0]); };
    var cam = $('#impCam'); if (cam) cam.onchange = function(){ if (cam.files && cam.files[0]) impLoad(cam.files[0]); };
    var lg = $('#impLang'); if (lg) lg.onchange = function(){ imp.lang = lg.value; };
    var g = $('#impGo'); if (g) g.onclick = function(){ var t = ($('#impTxt').value||'').trim(); if (!t) return; var rr = JCREP.parseText(JCREP.fixOcr(t)); rr.text = t; rr.ocr = false; impDone(rr, T('eingefügter Text','вставленный текст')); };
    main.querySelectorAll('[data-ic]').forEach(function(cb){ cb.onchange = function(){ imp.sel[cb.dataset.ic] = cb.checked; var n = imp.items.filter(function(c){ return imp.sel[c.code]; }).length, b = $('#impDiag'); if (b){ b.disabled = !n; b.textContent = T('Geführte Diagnose starten','Начать пошаговую диагностику')+' ('+n+')'; } }; });
    var d = $('#impDiag'); if (d) d.onclick = function(){
      if (state.diag && state.diag.codes.length){ toast(T('Erst die laufende Diagnose abschließen','Сначала заверши текущую диагностику')); return; }
      var fz = imp.res.fz || {}, list = imp.items.filter(function(c){ return imp.sel[c.code]; }).map(function(c){ return {code:c.code, set:c.status, desc:c.desc, ftb:c.ftb, module:c.module}; });
      state.fzNext = impFz(fz);
      diagStart(list, T('Bericht','Отчёт'), {car:T('Import','Импорт')+': '+(fz.geraet||T('Diagnosegerät','прибор'))+(fz.datum?' · '+fz.datum:'')});
    };
  });
  return h;
}

/* ---------- Fehlercodes (DTC) ---------- */
var DTC = X.dtc || {texts:[], segs:[]};
var GENERIC = 'Antrieb, ohne genauere genormte Zuordnung';
var SEV = {hoch:['hoch','высокая','hi'], mittel:['mittel','средняя','na'], niedrig:['niedrig','низкая','ok']};
function dtcNorm(x){ var s = String(x||'').trim().toUpperCase().replace(/[\s\-_.]/g,''); if (/^[0-9A-F]{4}$/.test(s)) s = 'P'+s; return /^[PCBU][0-3][0-9A-F]{3}$/.test(s) ? s : null; }
function dtcHex(c){ return parseInt(c.slice(1),16); }
function dtcSeg(code){ var n = dtcHex(code); for (var i=0;i<DTC.segs.length;i++){ var g = DTC.segs[i]; if (g[0][0]!==code[0] || g[0][1]!==code[1]) continue; if (dtcHex(g[0])<=n && n<=dtcHex(g[1])) return g; } return null; }
function dtcAdvice(raw){
  var code = dtcNorm(raw); if (!code) return null;
  var L0 = code[0], d2 = code[1], mfr = (L0==='P'||L0==='U') ? (d2==='1'||d2==='3') : d2!=='0', look = code, mirror = '';
  if (mfr && (d2==='1'||d2==='3')) { look = L0 + (d2==='1'?'0':'2') + code.slice(2); mirror = look; }
  var g = dtcSeg(look); if (!g) return {code:code, missing:true, mfr:mfr};
  return {code:code, mirror:mirror, mfr:mfr, seg:g, t:DTC.texts[g[2]]};
}
function dtcCard(a){
  if (!a) return '';
  if (a.missing) return '<div class="mess"><b>'+esc(a.code)+'</b><p class="muted">'+(a.mfr?T('Herstellercode ohne genormte Entsprechung – Herstellerdaten (HaynesPro) nötig.','Код производителя без стандартного аналога — нужны данные производителя (HaynesPro).'):T('Kein Eintrag für diesen Code.','Для этого кода нет записи.'))+'</p></div>';
  var t = a.t, sv = SEV[t.severity]||[t.severity,t.severity,'na'], range = a.seg[0]===a.seg[1] ? a.seg[0] : a.seg[0]+'–'+a.seg[1];
  return '<article class="mess"><div class="r1"><b class="mono" style="font-size:var(--text-lg)">'+esc(a.code)+'</b><span><span class="st '+sv[2]+'">'+esc(T('Priorität ','Приоритет: ')+T(sv[0],sv[1]))+'</span> <span class="badge">'+esc(t.system)+'</span></span></div>' +
    '<h2 style="margin:4px 0">'+esc(t.title)+'</h2><p class="meta">'+T('Bereich','Диапазон')+' '+esc(range)+' · '+a.seg[3]+' '+T('Codes','кодов')+'</p>' +
    (a.mirror ? '<p class="note">'+T('Herstellercode. Orientierung am genormten ','Код производителя. Ориентир по стандартному ')+esc(a.mirror)+T(', keine Herstellertabelle.',', не заводская таблица.')+'</p>' : '') +
    '<p>'+esc(t.summary)+'</p><h3>'+T('Was prüfen','Что проверить')+'</h3><ol>'+t.steps.map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ol>' +
    '<h3>'+T('Kapitel in dieser Reihenfolge','Главы в этом порядке')+'</h3><div class="mess-list">'+t.chapters.map(function(c){ var it = byId[c.id]; return it ? '<a class="result" href="#b-'+it.id+'"><div class="rt">'+esc(L(it,'title'))+' <span class="badge">'+esc(c.kind)+'</span></div><div class="snip">'+esc(c.why)+'</div></a>' : ''; }).join('')+'</div></article>';
}
function vDtc(){
  var q = state.dtcQ || '';
  var codes = q.split(/[\s,;]+/).map(dtcNorm).filter(function(c,i,a){ return c && a.indexOf(c)===i; });
  var h = '<div class="wrap">'+crumbs([T('Fehlercodes','Коды ошибок')])+'<h1>'+T('Fehlercodes (OBD)','Коды ошибок (OBD)')+'</h1><p class="lead">'+T('Code eingeben (auch mehrere): Priorität, was zuerst prüfen und welche Kapitel in welcher Reihenfolge. P1/P3-Herstellercodes werden am genormten P0/P2-Nachbarn orientiert.','Введи код (можно несколько): приоритет, что проверить первым и какие главы в каком порядке. Коды производителя P1/P3 ориентируются по стандартному соседу P0/P2.')+'</p>' +
    '<form id="dtcForm" class="filterbar"><input id="dtcIn" type="search" value="'+esc(q)+'" placeholder="P0118, P0335 U0100" autocomplete="off"><button class="btn primary" type="submit">'+T('Prüfen','Проверить')+'</button></form>' +
    '<div class="chips">'+['P0118','P0171','P0300','P0335','P0562','C0035','U0100'].map(function(c){ return '<button type="button" class="chip" data-c="'+c+'">'+c+'</button>'; }).join('')+'</div>' + deNote().replace('Текст главы пока','Тексты подсказок пока') +
    (codes.length ? '<div class="btn-row"><button class="btn primary" id="dtcDiag">'+T('Geführte Diagnose mit diesen Codes','Пошаговая диагностика по этим кодам')+' ('+codes.length+')</button></div>' : '') +
    '<div class="mess-list" style="margin-top:16px">'+codes.map(function(c){ return dtcCard(dtcAdvice(c)); }).join('')+'</div>';
  if (!codes.length) {
    h += '<h2>'+T('Abgedeckte Bereiche','Охваченные диапазоны')+'</h2><div class="filterbar"><input id="segF" type="search" placeholder="'+T('Filtern: Lambda, P03, CAN','Фильтр: Lambda, P03, CAN')+'"><span class="muted" id="segN"></span></div><div class="tbl big"><table><thead><tr><th>'+T('Bereich','Диапазон')+'</th><th>'+T('Thema','Тема')+'</th><th>'+T('System','Система')+'</th><th>'+T('Priorität','Приоритет')+'</th></tr></thead><tbody id="segB"></tbody></table></div>';
  }
  h += '<p class="muted" style="font-size:var(--text-xs)">'+T('Quelle: eigene DTC-Regeln (kfz-diagnose/dtc.ts, SAE J2012-Struktur). Orientierung, keine Herstellertabelle.','Источник: собственные правила DTC (kfz-diagnose/dtc.ts, структура SAE J2012). Ориентир, не заводская таблица.')+'</p>' + foot() + '</div>';
  after(function(){
    var dg = $('#dtcDiag'); if (dg) dg.onclick = function(){ diagStart(codes.map(function(c){ return {code:c, set:'manual'}; }), T('manuell','вручную')); };
    $('#dtcForm').onsubmit = function(e){ e.preventDefault(); state.dtcQ = $('#dtcIn').value; render(true); };
    main.querySelectorAll('[data-c]').forEach(function(b){ b.onclick = function(){ state.dtcQ = b.dataset.c; render(true); }; });
    var sf = $('#segF'); if (!sf) return;
    function draw(){ var f = norm(sf.value); var r = DTC.segs.filter(function(g){ var t = DTC.texts[g[2]]; return t.title!==GENERIC && (!f || norm(g[0]+' '+g[1]+' '+t.title+' '+t.system).indexOf(f)>=0); });
      $('#segB').innerHTML = r.map(function(g){ var t = DTC.texts[g[2]], sv = SEV[t.severity]||[t.severity,t.severity,'na']; return '<tr><td class="mono"><a href="#dtc" data-g="'+g[0]+'">'+esc(g[0]===g[1]?g[0]:g[0]+'–'+g[1])+'</a></td><td>'+esc(t.title)+'</td><td>'+esc(t.system)+'</td><td><span class="st '+sv[2]+'">'+esc(T(sv[0],sv[1]))+'</span></td></tr>'; }).join('');
      $('#segN').textContent = r.length+' '+T('Bereiche','диапазонов');
      main.querySelectorAll('[data-g]').forEach(function(a){ a.onclick = function(e){ e.preventDefault(); state.dtcQ = a.dataset.g; render(); }; });
    }
    sf.addEventListener('input', draw); draw();
  });
  return h;
}

/* ---------- Rechner ---------- */
var NTC = [[-20,15500],[20,2500],[60,596],[80,323]];
function ntcT(r){ for (var i=0;i<NTC.length-1;i++){ var a=NTC[i], b=NTC[i+1]; if (r<=a[1] && r>=b[1]){ var f=(Math.log(a[1])-Math.log(r))/(Math.log(a[1])-Math.log(b[1])); return a[0]+f*(b[0]-a[0]); } } return null; }
function vCalc(){
  var h = '<div class="wrap">'+crumbs([T('Rechner','Калькуляторы')])+'<h1>'+T('Rechner für die Werkstatt','Калькуляторы для мастерской')+'</h1><p class="lead">'+T('Schnelle Umrechnungen beim Messen. Ergebnisse sind Orientierung, keine Diagnose.','Быстрые расчёты при замерах. Результат — ориентир, а не диагноз.')+'</p><div class="calc-grid">';
  h += calc('ohm',T('Ohmsches Gesetz','Закон Ома'),T('Zwei Werte eingeben, der dritte wird berechnet.','Введи два значения — третье рассчитается.'), f('ohmU',T('Spannung U (V)','Напряжение U (В)'),'12')+f('ohmR',T('Widerstand R (Ω)','Сопротивление R (Ом)'),'')+f('ohmI',T('Strom I (A)','Ток I (А)'),'0,8'));
  h += calc('vd',T('Spannungsfall an Leitung oder Masse','Падение напряжения на проводе или массе'),T('Messung unter Last zwischen zwei Punkten einer Leitung.','Замер под нагрузкой между двумя точками одного провода.'), f('vdU',T('Gemessener Spannungsfall (mV)','Измеренное падение (мВ)'),'150')+sel('vdT',T('Leitungsart','Тип цепи'),[['50',T('Sensormasse (< 50 mV)','Масса датчика (< 50 мВ)')],['200',T('Plus-/Masseleitung Verbraucher (< 200 mV, Erfahrungswert)','Плюс/масса потребителя (< 200 мВ, опыт)')],['500',T('Starter-Hauptleitung (< 500 mV, Erfahrungswert)','Силовой провод стартера (< 500 мВ, опыт)')]]));
  h += calc('pwm',T('PWM und Tastverhältnis','ШИМ и скважность'),T('Aus Ein-Zeit und Periode.','По времени включения и периоду.'), '<div class="row2">'+f('pwOn',T('Ein-Zeit (ms)','Время вкл. (мс)'),'2')+f('pwT',T('Periode (ms)','Период (мс)'),'10')+'</div>'+f('pwU',T('Versorgung (V)','Питание (В)'),'14'));
  h += calc('t2',T('Typ 2: Ladestrom aus CP-Tastverhältnis','Type 2: ток заряда по скважности CP'),T('IEC 61851: 10–85 % Tastverhältnis → Strom = Tastverhältnis × 0,6 A.','IEC 61851: скважность 10–85 % → ток = скважность × 0,6 А.'), f('t2D',T('Tastverhältnis (%)','Скважность (%)'),'50'));
  h += calc('iso',T('Isolationswiderstand Mindestwert','Минимальное сопротивление изоляции'),T('Mindestwert = Nennspannung × Ω/V. Herstellerwerte gehen vor.','Минимум = номинальное напряжение × Ом/В. Данные производителя приоритетнее.'), f('isU',T('HV-Nennspannung (V)','Номинальное ВВ (В)'),'400')+sel('isK',T('Kriterium','Критерий'),[['500',T('500 Ω/V (AC-Kreise, Werkstatt-Grenze)','500 Ом/В (цепи AC, предел мастерской)')],['100',T('100 Ω/V (DC-Kreise, ECE R100)','100 Ом/В (цепи DC, ECE R100)')]])+f('isM',T('Gemessen (MΩ, optional)','Замер (МОм, по желанию)'),''));
  h += calc('ntc',T('NTC-Kühlmittelsensor: Widerstand → Temperatur','NTC датчик ОЖ: сопротивление → температура'),T('Interpolation der Bosch-Kennlinie aus Kapitel 4.','Интерполяция характеристики Bosch из главы 4.'), f('ntR',T('Gemessener Widerstand (Ω)','Измеренное сопротивление (Ом)'),'2500'));
  h += '</div>'+foot()+'</div>';
  function calc(id,t,p,body){ return '<section class="calc"><h2>'+t+'</h2><p>'+p+'</p>'+body+'<div class="out" id="o_'+id+'" aria-live="polite">–</div></section>'; }
  function f(id,l,v){ return '<div class="field"><label for="'+id+'">'+l+'</label><input id="'+id+'" inputmode="decimal" value="'+v+'"></div>'; }
  function sel(id,l,o){ return '<div class="field"><label for="'+id+'">'+l+'</label><select id="'+id+'">'+o.map(function(x){return '<option value="'+x[0]+'">'+x[1]+'</option>';}).join('')+'</select></div>'; }
  after(bindCalc);
  return h;
}
function num(id){ var e=document.getElementById(id); if(!e) return NaN; var v=e.value.replace(/\s/g,'').replace(',','.'); return v===''?NaN:parseFloat(v); }
function fmt(x,d){ return (Math.round(x*Math.pow(10,d))/Math.pow(10,d)).toLocaleString(state.lang==='ru'?'ru-RU':'de-DE'); }
function out(id,html,cls){ var o=document.getElementById('o_'+id); o.innerHTML=html; o.className='out'+(cls?' '+cls:''); }
function bindCalc(){
  function ohm(){ var U=num('ohmU'),R=num('ohmR'),I=num('ohmI');
    if(!isNaN(U)&&!isNaN(I)&&isNaN(R)) out('ohm','R = '+fmt(U/I,2)+' Ω<small>P = '+fmt(U*I,2)+' W</small>');
    else if(!isNaN(U)&&!isNaN(R)&&isNaN(I)) out('ohm','I = '+fmt(U/R,3)+' A<small>P = '+fmt(U*U/R,2)+' W</small>');
    else if(!isNaN(R)&&!isNaN(I)&&isNaN(U)) out('ohm','U = '+fmt(R*I,2)+' V<small>P = '+fmt(R*I*I,2)+' W</small>');
    else out('ohm',T('Genau zwei Felder ausfüllen','Заполни ровно два поля')); }
  function vd(){ var u=num('vdU'), lim=parseFloat(document.getElementById('vdT').value); if(isNaN(u)) return out('vd',T('Wert eingeben','Введи значение')); var ok=u<lim; out('vd',(ok?T('In Ordnung','В норме'):T('Zu hoch','Слишком много'))+': '+fmt(u,0)+' mV<small>'+T('Grenze','Предел')+' '+lim+' mV · '+(ok?T('kein Hinweis auf Übergangswiderstand','признаков переходного сопротивления нет'):T('Masse/Stecker auf Korrosion prüfen','проверь массу/разъём на коррозию'))+'</small>', ok?'good':'bad'); }
  function pwm(){ var on=num('pwOn'),Tp=num('pwT'),U=num('pwU'); if(isNaN(on)||isNaN(Tp)||Tp<=0||on>Tp) return out('pwm',T('Ein-Zeit ≤ Periode eingeben','Время вкл. ≤ периода')); var d=on/Tp*100; out('pwm',T('Tastverhältnis ','Скважность ')+fmt(d,1)+' %<small>'+T('Frequenz ','Частота ')+fmt(1000/Tp,1)+' Hz'+(isNaN(U)?'':' · '+T('Mittelwert ca. ','среднее ок. ')+fmt(U*d/100,2)+' V')+'</small>'); }
  function t2(){ var d=num('t2D'); if(isNaN(d)) return out('t2',T('Wert eingeben','Введи значение')); if(d<10||d>85) return out('t2',T('Außerhalb 10–85 %','Вне диапазона 10–85 %'),'bad'); out('t2',T('Max. Ladestrom ','Макс. ток заряда ')+fmt(d*0.6,1)+' A<small>'+T('je Phase · 3 Phasen 230 V ca. ','на фазу · 3 фазы 230 В ок. ')+fmt(d*0.6*230*3/1000,1)+' kW</small>','good'); }
  function iso(){ var U=num('isU'),k=parseFloat(document.getElementById('isK').value),M=num('isM'); if(isNaN(U)) return out('iso',T('Nennspannung eingeben','Введи номинальное напряжение')); var min=U*k; var s=T('Mindestens ','Минимум ')+(min>=1e6?fmt(min/1e6,2)+' MΩ':fmt(min/1000,0)+' kΩ'); if(!isNaN(M)){ var ok=M*1e6>=min; return out('iso',s+'<small>'+fmt(M,2)+' MΩ: '+(ok?T('über Mindestwert','выше минимума'):T('unter Mindestwert, Fahrzeug nicht in Betrieb nehmen','ниже минимума, автомобиль не эксплуатировать'))+'</small>',ok?'good':'bad'); } out('iso',s); }
  function ntc(){ var r=num('ntR'); if(isNaN(r)||r<=0) return out('ntc',T('Widerstand eingeben','Введи сопротивление')); var t=ntcT(r); if(t===null) return out('ntc',T('Außerhalb −20 bis 80 °C','Вне диапазона −20…80 °C'),'bad'); out('ntc',T('ca. ','ок. ')+fmt(t,0)+' °C<small>'+T('Mit Thermometer am Sensor vergleichen; Abweichung > 5 °C ist auffällig','Сравни с термометром у датчика; отклонение > 5 °C подозрительно')+'</small>'); }
  [['ohmU','ohmR','ohmI',ohm],['vdU','vdT',vd],['pwOn','pwT','pwU',pwm],['t2D',t2],['isU','isK','isM',iso],['ntR',ntc]].forEach(function(g){ var fn=g[g.length-1]; g.slice(0,-1).forEach(function(id){ var e=document.getElementById(id); e.addEventListener('input',fn); e.addEventListener('change',fn); }); fn(); });
}

/* ---------- Fahrzeuge (Akte), Cockpit, Befehlsleiste ---------- */
function kzNorm(k){ return String(k||'').toUpperCase().replace(/[^A-Z0-9ÄÖÜ]/g,''); }
function fzKey(fz){ fz = fz || {}; var v = String(fz.vin||'').toUpperCase(); if (v.length===17) return 'v'+v; var k = kzNorm(fz.kz); return k ? 'k'+k : ''; }
function vehicles(){
  var map = {};
  function get(key){ return map[key] || (map[key] = {key:key, fz:{}, reports:[], mess:[], active:false, last:''}); }
  function merge(V, fz, date){ ['kz','marke','modell','vin','km','kunde','tel'].forEach(function(k){ if (fz && fz[k] && (!V.fz[k] || (date && date >= (V._d||'')))) V.fz[k] = fz[k]; }); if (date && date > (V._d||'')) V._d = date; if (date && date > V.last) V.last = date; }
  state.archiv.forEach(function(r){ var k = fzKey(r.fz); if (!k) return; var V = get(k); V.reports.push(r); merge(V, r.fz, r.ended||r.started); });
  if (state.diag){ var k0 = fzKey(state.diag.fz); if (k0){ var V0 = get(k0); V0.active = true; merge(V0, state.diag.fz, state.diag.started); } }
  // kz-Fahrzeuge in VIN-Fahrzeuge einsortieren, wenn gleiches Kennzeichen
  Object.keys(map).forEach(function(k){ if (k[0]!=='k') return; var kz = k.slice(1); var tgt = Object.keys(map).find(function(o){ return o[0]==='v' && kzNorm(map[o].fz.kz)===kz; }); if (tgt){ var A = map[k], B = map[tgt]; B.reports = B.reports.concat(A.reports); B.active = B.active || A.active; if (A.last > B.last) B.last = A.last; delete map[k]; } });
  state.mess.forEach(function(m){
    var vin = String(m.vin||'').toUpperCase(), kz = kzNorm(m.kz), key = '';
    if (vin.length===17 && map['v'+vin]) key = 'v'+vin;
    if (!key && vin.length>=6) key = Object.keys(map).find(function(o){ return o[0]==='v' && o.slice(1).slice(-vin.length)===vin; }) || '';
    if (!key && kz) key = Object.keys(map).find(function(o){ return kzNorm(map[o].fz.kz)===kz; }) || ('k'+kz);
    if (!key && vin.length===17) key = 'v'+vin;
    if (!key) return;
    var V = get(key); V.mess.push(m); merge(V, {kz:m.kz, marke:m.marke, modell:m.modell, vin:vin.length===17?vin:''}, m.datum);
  });
  return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a,b){ return (b.active?1:0)-(a.active?1:0) || (b.last||'').localeCompare(a.last||''); });
}
function vehOf(key){ return vehicles().find(function(v){ return v.key===key; }); }
function vehTitle(V){ var f = V.fz||{}; return [f.marke, f.modell].filter(Boolean).join(' ') || T('Fahrzeug','Автомобиль'); }
function plate(kz){ return kz ? '<span class="kz">'+esc(kz)+'</span>' : ''; }
function dateOnly(iso){ return iso ? new Date(iso).toLocaleDateString(state.lang==='ru'?'ru-RU':'de-DE', {day:'2-digit', month:'2-digit', year:'numeric'}) : ''; }

/* Cockpit (Startseite) */
function vCockpit(){
  var D0 = state.diag, vs = vehicles(), curV = null;
  if (D0 && fzKey(D0.fz)) curV = vs.find(function(v){ return v.key===fzKey(D0.fz); });
  var fz = (D0 && D0.fz) || (obd.veh ? vehToFz(obd.veh, {}) : null) || {};
  var h = '<div class="wrap cockpit">';
  h += '<div class="ck-strip">' + (fzSummary(fz) || fz.vin ? plate(fz.kz)+'<b>'+esc([fz.marke, fz.modell].filter(Boolean).join(' ')||T('Fahrzeug','Автомобиль'))+'</b><span class="meta">'+esc([fz.km?Number(fz.km).toLocaleString(state.lang==='ru'?'ru-RU':'de-DE')+' km':'', fz.kunde].filter(Boolean).join(' · '))+'</span>'+(curV?'<a class="btn small" href="#fz-'+curV.key+'">'+T('Fahrzeugakte','Карточка машины')+'</a>':'') : '<b>'+T('Kein Fahrzeug aktiv','Машина не выбрана')+'</b>') +
    '<span class="ck-obd'+(obd.io?' on':'')+'"><i></i>'+(obd.io?esc(obd.name)+(obd.info?' · '+esc(obd.info.name.replace(/\s*\(.*\)/,'')):''):T('OBD nicht verbunden','OBD не подключён'))+'</span></div>';
  // Große Kachel
  var big;
  if (D0 && D0.codes.length){ var c = D0.codes[Math.min(D0.ci, D0.codes.length-1)], a = dtcAdvice(c.code), open = D0.codes.filter(function(x){return !x.done;}).length;
    big = '<a class="ck-tile ck-big" href="#diag"><svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l3-7 4 14 3-7h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><div><span class="ck-k">'+T('Weiter','Продолжить')+'</span><span class="ck-h">'+T('Diagnose','Диагностика')+'<br><span class="mono">'+esc(c.code)+'</span> · '+T('Schritt ','шаг ')+(c.si+1)+'/'+c.steps.length+'</span><span class="ck-s">'+esc(a&&a.t?a.t.title:'')+' · '+open+' '+T('Codes offen','кодов открыто')+'</span></div></a>';
  } else if (obd.io){
    big = '<a class="ck-tile ck-big" href="#obd"><svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v6M17 4v6M5 10h14v4a7 7 0 0 1-14 0zM12 21v-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><div><span class="ck-k">'+T('Adapter verbunden','Адаптер подключён')+'</span><span class="ck-h">'+T('Fehler lesen<br>und Diagnose starten','Прочитать ошибки<br>и начать диагностику')+'</span></div></a>';
  } else {
    big = '<a class="ck-tile ck-big" href="#obd"><svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v6M17 4v6M5 10h14v4a7 7 0 0 1-14 0zM12 21v-2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><div><span class="ck-k">'+T('Start','Начать')+'</span><span class="ck-h">'+T('Fahrzeug<br>verbinden','Подключить<br>машину')+'</span><span class="ck-s">'+T('Bluetooth LE, USB oder Demo','Bluetooth LE, USB или демо')+'</span></div></a>';
  }
  var liveTxt = obd.live.length ? obd.live.slice(0,2).map(function(r){ return r.text; }).join(' · ') : (obd.io ? T('starten','запустить') : T('Adapter nötig','нужен адаптер'));
  var tile = function(href, icon, col, title, sub){ return '<a class="ck-tile" href="'+href+'"><svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d="'+icon+'" fill="none" stroke="'+col+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><div><span class="ck-t">'+title+'</span><span class="ck-s">'+sub+'</span></div></a>'; };
  h += '<div class="ck-grid">' + big +
    tile('#obd', 'M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3', 'var(--ck-a2)', T('Fehler lesen','Прочитать ошибки'), obd.dtcs ? ([].concat(obd.dtcs.stored, obd.dtcs.pending, obd.dtcs.permanent).length+' '+T('Codes','кодов')) : 'OBD') +
    tile('#obd', 'M4 18h16M6 15l4-6 3 4 3-5 3 7', 'var(--ck-a2)', T('Live-Daten','Живые данные'), esc(liveTxt)) +
    tile('#mess-neu', 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3', 'var(--ck-a3)', T('Neue Messung','Новый замер'), T('Soll / Ist / Foto','норма / факт / фото')) +
    tile('#fz', 'M4 5h16v14H4zM8 9h8M8 13h5', 'var(--ck-a3)', T('Fahrzeuge & Berichte','Машины и отчёты'), vs.length+' '+T('Fahrzeuge','машин')+' · '+state.archiv.length+' '+T('Berichte','отчётов')) +
  '</div>';
  var small = [['#dtc',T('Fehlercodes','Коды ошибок')],['#oszi',T('Oszillogramme','Осциллограммы')],['#kat-sensoren',T('Nachschlagewerk','Справочник')],['#systemtests',T('Systemtests','Системные тесты')],['#rechner',T('Rechner','Калькуляторы')],['#tab-overview',T('Tabellen','Таблицы')]];
  h += '<div class="ck-small">'+small.map(function(s){ return '<a href="'+s[0]+'">'+s[1]+'</a>'; }).join('')+'</div>';
  h += '<div class="ck-panne"><span>'+T('Pannenhilfe:','Выезд:')+'</span>'+PANNE.slice(0,6).map(function(id){ var it = byId[id]; return it ? '<a href="#b-'+id+'">'+esc(L(it,'title').replace(/\s*\(.*\)/,''))+'</a>' : ''; }).join('')+'</div>';
  if (vs.length){ h += '<h2>'+T('Zuletzt bearbeitet','Недавние машины')+'</h2><div class="ck-recent">'+vs.slice(0,4).map(function(V){ return '<a class="ber" href="#fz-'+V.key+'"><div class="ber-top">'+plate(V.fz.kz)+'<b>'+esc(vehTitle(V))+'</b>'+(V.active?'<span class="st na">'+T('läuft','идёт')+'</span>':'')+'</div><span class="meta">'+esc([V.fz.kunde, dateOnly(V.last), V.reports.length+' '+T('Berichte','отчётов'), V.mess.length+' '+T('Messungen','замеров')].filter(Boolean).join(' · '))+'</span></a>'; }).join('')+'</div>'; }
  h += '<div class="callout" style="margin-top:18px"><b>'+T('Hinweis','Важно')+'</b><p>'+T('Alle Werte sind typische Richtwerte. Verbindlich sind Herstellerdaten (HaynesPro, Carmin).','Все значения — типовые ориентиры. Обязательны данные производителя (HaynesPro, Carmin).')+'</p></div>';
  return h + foot() + '</div>';
}

/* Fahrzeugakte */
function vAkte(key){
  var vs = vehicles(), V = key ? vs.find(function(v){ return v.key===key; }) : vs[0];
  var q = state.fzQ || '';
  var list = vs.filter(function(v){ if (!q) return true; var f = v.fz; return norm([f.kz, kzNorm(f.kz), f.marke, f.modell, f.vin, f.kunde, f.tel].join(' ')).indexOf(norm(q))>=0; });
  var h = '<div class="wrap akte-wrap">'+crumbs([T('Fahrzeuge','Машины')])+'<div class="akte">';
  h += '<aside class="akte-list"><div class="akte-lh"><b>'+T('Fahrzeuge','Машины')+'</b><a class="btn small primary" href="#obd">+ '+T('Neu','Новая')+'</a></div><input id="fzQ" type="search" value="'+esc(q)+'" placeholder="'+T('Kennzeichen, Modell, Kunde, VIN','Номер, модель, клиент, VIN')+'">' +
    (list.length ? list.map(function(v){ return '<a class="akte-item'+(V&&v.key===V.key?' on':'')+'" href="#fz-'+v.key+'"><span>'+(v.fz.kz?'<b class="mono">'+esc(v.fz.kz)+'</b> · ':'')+esc(vehTitle(v))+'</span><span class="meta">'+esc([v.fz.kunde, dateOnly(v.last)].filter(Boolean).join(' · '))+(v.active?' · <span class="st na">'+T('läuft','идёт')+'</span>':'')+'</span></a>'; }).join('') : '<p class="meta" style="padding:8px">'+T('Noch keine Fahrzeuge. Sie entstehen aus Diagnosen und Messungen mit Kennzeichen oder VIN.','Машин пока нет. Они появляются из диагностик и замеров с госномером или VIN.')+'</p>') + '</aside>';
  if (!V){ return h + '<section class="akte-main"><div class="empty"><p>'+T('Fahrzeug wählen oder neu verbinden.','Выбери машину или подключи новую.')+'</p></div></section></div>'+foot()+'</div>'; }
  var f = V.fz, tab = state.fzTab || 'codes';
  var codes = []; V.reports.concat(V.active && state.diag ? [state.diag] : []).forEach(function(r){ r.codes.forEach(function(c){ codes.push({c:c, r:r, active: state.diag && r.id===state.diag.id}); }); });
  codes.sort(function(a,b){ return (b.r.started||'').localeCompare(a.r.started||''); });
  var photos = []; V.mess.forEach(function(m){ (m.photos||[]).forEach(function(p){ photos.push(p); }); });
  var tabs = [['codes',T('Codes','Коды'),codes.length],['diag',T('Diagnose','Диагностика'),V.active?'●':''],['mess',T('Messungen','Замеры'),V.mess.length],['fotos',T('Fotos','Фото'),photos.length],['hist',T('Historie','История'),V.reports.length],['bericht',T('Bericht','Отчёт'),'']];
  h += '<section class="akte-main"><div class="akte-head">'+plate(f.kz)+'<div><div class="akte-title">'+esc(vehTitle(V))+'</div><div class="meta">'+esc([f.kunde, f.tel, f.km?Number(f.km).toLocaleString(state.lang==='ru'?'ru-RU':'de-DE')+' km':'', f.vin?'VIN '+f.vin:''].filter(Boolean).join(' · '))+'</div></div><button class="btn primary" id="fzNew">'+(V.active?T('Diagnose fortsetzen','Продолжить диагностику'):T('Neue Diagnose','Новая диагностика'))+'</button></div>' +
    '<nav class="tabs" role="tablist">'+tabs.map(function(t){ return '<button role="tab" aria-selected="'+(t[0]===tab)+'" data-fztab="'+t[0]+'">'+t[1]+(t[2]!==''&&t[2]!==0?' ('+t[2]+')':'')+'</button>'; }).join('')+'</nav><div class="akte-body">';
  if (tab==='codes'){
    h += codes.length ? '<div class="tbl"><table><thead><tr><th>'+T('Code','Код')+'</th><th>'+T('Thema','Тема')+'</th><th>'+T('Datum','Дата')+'</th><th>'+T('Status','Статус')+'</th><th>'+T('Ursache / Reparatur','Причина / ремонт')+'</th></tr></thead><tbody>'+codes.map(function(x){ var a = dtcAdvice(x.c.code); return '<tr><td class="mono"><b>'+esc(x.c.code)+'</b></td><td>'+esc(a&&a.t?a.t.title:'')+'</td><td>'+dateOnly(x.r.started)+'</td><td><span class="st '+(x.c.done?'ok':'hi')+'">'+(x.c.done?T('erledigt','закрыт'):T('offen','открыт'))+'</span></td><td>'+esc(x.c.cause||'')+'</td></tr>'; }).join('')+'</tbody></table></div>' : '<p class="muted">'+T('Noch keine Fehlercodes für dieses Fahrzeug.','По этой машине кодов пока нет.')+'</p>';
  } else if (tab==='diag'){
    if (V.active && state.diag){ var D0 = state.diag; h += '<div class="ber-codes">'+D0.codes.map(function(c){ return '<span class="st '+(c.done?'ok':'hi')+'"><span class="mono">'+esc(c.code)+'</span></span>'; }).join(' ')+'</div><div class="btn-row"><a class="btn primary" href="#diag">'+T('Diagnose fortsetzen','Продолжить диагностику')+'</a><a class="btn" href="#diag-bericht">'+T('Bericht','Отчёт')+'</a></div>'; }
    else h += '<p class="muted">'+T('Keine laufende Diagnose. „Neue Diagnose“ übernimmt die Fahrzeugdaten und öffnet OBD.','Нет текущей диагностики. «Новая диагностика» возьмёт данные машины и откроет OBD.')+'</p>';
  } else if (tab==='mess'){
    h += V.mess.length ? '<div class="mess-list">'+V.mess.map(messCard).join('')+'</div>' : '<p class="muted">'+T('Keine Messungen.','Замеров нет.')+'</p>';
    after(bindMessCards);
  } else if (tab==='fotos'){
    h += photos.length ? photoThumbs(photos, false) : '<p class="muted">'+T('Keine Fotos.','Фото нет.')+'</p>';
    after(function(){ fillThumbs(main, photos); });
  } else if (tab==='hist'){
    h += V.reports.length ? '<div class="ber-list">'+V.reports.slice().sort(function(a,b){ return (b.started||'').localeCompare(a.started||''); }).map(function(r){ var causes = r.codes.map(function(c){ return c.cause; }).filter(Boolean); return '<article class="ber"><div class="ber-top"><b>'+dateOnly(r.ended||r.started)+'</b><span class="meta">'+esc(r.fz&&r.fz.km?r.fz.km+' km':'')+'</span></div><div class="ber-codes">'+r.codes.map(function(c){ return '<span class="st '+(c.done?'ok':'hi')+'"><span class="mono">'+esc(c.code)+'</span></span>'; }).join(' ')+'</div>'+(causes.length?'<p class="ber-cause">'+esc(causes.join(' · '))+'</p>':'')+'<div class="btn-row" style="margin:4px 0 0"><a class="btn small primary" href="#bericht-'+esc(r.id)+'">'+T('Bericht öffnen','Открыть отчёт')+'</a></div></article>'; }).join('')+'</div>' : '<p class="muted">'+T('Noch keine abgeschlossenen Berichte.','Завершённых отчётов пока нет.')+'</p>';
  } else {
    var last = V.reports.slice().sort(function(a,b){ return (b.started||'').localeCompare(a.started||''); })[0];
    if (V.active) h += '<div class="btn-row"><a class="btn primary" href="#diag-bericht">'+T('Bericht der laufenden Diagnose','Отчёт текущей диагностики')+'</a></div>';
    h += last ? '<div class="btn-row"><a class="btn" href="#bericht-'+esc(last.id)+'">'+T('Letzter Bericht vom ','Последний отчёт от ')+dateOnly(last.ended||last.started)+'</a></div>' : (V.active?'':'<p class="muted">'+T('Noch kein Bericht.','Отчёта пока нет.')+'</p>');
  }
  h += '</div></section></div>' + foot() + '</div>';
  after(function(){
    var qi = $('#fzQ'); qi.addEventListener('input', function(){ state.fzQ = qi.value; clearTimeout(qi.t); qi.t = setTimeout(function(){ render(true); var n = $('#fzQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    main.querySelectorAll('[data-fztab]').forEach(function(b){ b.onclick = function(){ state.fzTab = b.dataset.fztab; render(true); }; });
    $('#fzNew').onclick = function(){ if (V.active){ go('diag'); return; } if (state.diag){ toast(T('Erst die laufende Diagnose abschließen','Сначала заверши текущую диагностику')); return; } state.fzNext = JSON.parse(JSON.stringify(V.fz)); state.fzNext.km = ''; toast(T('Fahrzeugdaten übernommen – jetzt Fehler lesen','Данные машины взяты — теперь прочитай ошибки')); go('obd'); };
  });
  return h;
}

/* Befehlsleiste */
var CMD = {items:[], sel:0, open:false};
function cmdBuild(q){
  var out = [], qq = q.trim(), nq = norm(qq);
  if (!qq) return out;
  var add = function(group, label, sub, act){ out.push({g:group, l:label, s:sub||'', a:act}); };
  var nav = function(r){ return function(){ go(r); }; };
  var G = {act:T('Aktionen','Действия'), fz:T('Fahrzeuge','Машины'), kap:T('Nachschlagewerk','Справочник'), more:T('Weitere','Ещё')};
  var codes = qq.split(/[\s,;]+/).filter(function(w){ return /^[pcbu][0-3][0-9a-f]{3}$/i.test(w); }).map(dtcNorm).filter(Boolean);
  if (codes.length){
    var D0 = state.diag, inDiag = D0 ? D0.codes.findIndex(function(c){ return c.code===codes[0]; }) : -1;
    if (inDiag>=0) add(G.act, T('Diagnose fortsetzen · ','Продолжить диагностику · ')+codes[0], T('Schritt ','шаг ')+(D0.codes[inDiag].si+1)+'/'+D0.codes[inDiag].steps.length, function(){ D0.ci = inDiag; diagSave(); go('diag'); });
    var a = dtcAdvice(codes[0]);
    add(G.act, T('Code prüfen · ','Проверить код · ')+codes.join(' '), a && a.t ? a.t.title : '', function(){ state.dtcQ = codes.join(' '); go('dtc'); });
    if (!D0) add(G.act, T('Geführte Diagnose starten · ','Начать диагностику · ')+codes.join(' '), '', function(){ diagStart(codes.map(function(c){ return {code:c, set:'manual'}; }), T('manuell','вручную')); });
    state.archiv.forEach(function(r){ r.codes.forEach(function(c){ if (codes.indexOf(c.code)>=0) add(G.more, T('Bericht · ','Отчёт · ')+c.code+' · '+[r.fz&&r.fz.kz, r.fz&&[r.fz.marke, r.fz.modell].filter(Boolean).join(' ')].filter(Boolean).join(' '), dateOnly(r.ended||r.started)+(c.cause?' · '+c.cause:''), nav('bericht-'+r.id)); }); });
  }
  if (/^(obd|adapter|verbinden|подключ)/i.test(qq)) add(G.act, T('Fahrzeug verbinden (OBD)','Подключить машину (OBD)'), '', nav('obd'));
  if (/^(mess|замер|messung)/i.test(qq)) add(G.act, T('Neue Messung','Новый замер'), '', function(){ startDraft({}); });
  if (/^(diag|диагн)/i.test(qq)) add(G.act, T('Geführte Diagnose','Пошаговая диагностика'), '', nav('diag'));
  var mb = qq.match(/^(bericht|berichte|отч[её]т\w*)\s*(.*)$/i); if (mb) add(G.act, T('Berichte suchen','Искать отчёты')+(mb[2]?' · '+mb[2]:''), '', function(){ state.berQ = mb[2]||''; go('berichte'); });
  var mo = qq.match(/^(ohm|ом)\s+(-?[\d.,]+)\s+(-?[\d.,]+)$/i);
  if (mo){ var U = pnum(mo[2]), I = pnum(mo[3]); if (I) add(G.act, 'U = '+fmt(U,2)+' V, I = '+fmt(I,3)+' A → R = '+fmt(U/I,2)+' Ω', 'P = '+fmt(U*I,2)+' W', nav('rechner')); }
  vehicles().forEach(function(V){ var f = V.fz; if (norm([f.kz, kzNorm(f.kz), f.marke, f.modell, f.vin, f.kunde, f.tel].join(' ')).indexOf(nq)>=0) add(G.fz, [f.kz, vehTitle(V)].filter(Boolean).join(' · '), [f.kunde, dateOnly(V.last)].filter(Boolean).join(' · '), nav('fz-'+V.key)); });
  if (nq.length>=2){
    var hits = D.items.map(function(it){ var t = norm(it.title+' '+it.title_ru); return {it:it, s: t.indexOf(nq)>=0 ? 10 : (norm(it.text).indexOf(nq)>=0 ? 1 : 0)}; }).filter(function(x){ return x.s; }).sort(function(a,b){ return b.s-a.s; }).slice(0,5);
    hits.forEach(function(x){ add(G.kap, L(x.it,'title'), L(catById[x.it.cat],'name'), nav('b-'+x.it.id)); });
    Object.keys(OSZ.waves).forEach(function(k){ var w = OSZ.waves[k]; if (norm(w.de.n+' '+w.ru.n).indexOf(nq)>=0) add(G.more, T('Oszillogramm · ','Осциллограмма · ')+(state.lang==='ru'?w.ru.n:w.de.n), w.de.set, nav('oszi')); });
    X.systemtests.rows.forEach(function(r){ if (norm(strip(r[0]+' '+r[1])).indexOf(nq)>=0) add(G.more, T('Systemtest · ','Системный тест · ')+strip(r[1]), strip(r[0]), function(){ state.sys = strip(r[0]); go('systemtests'); }); });
  }
  out = out.slice(0, 18);
  add(G.more, T('Alle Treffer anzeigen für „','Все результаты для «')+qq+T('“','»'), '', function(){ state.q = qq; go('suche'); });
  return out;
}
function cmdRender(){
  var box = $('#cmdBox'); if (!box) return;
  if (!CMD.open || !CMD.items.length){ box.hidden = true; return; }
  var last = null;
  box.innerHTML = CMD.items.map(function(it, i){ var gh = it.g!==last ? '<div class="cmd-g">'+esc(it.g)+'</div>' : ''; last = it.g; return gh + '<button type="button" class="cmd-i'+(i===CMD.sel?' on':'')+'" data-ci="'+i+'"><span class="cmd-l">'+esc(it.l)+'</span>'+(it.s?'<span class="cmd-s">'+esc(it.s)+'</span>':'')+'</button>'; }).join('');
  box.hidden = false;
  box.querySelectorAll('[data-ci]').forEach(function(b){ b.onmousedown = function(e){ e.preventDefault(); cmdRun(+b.dataset.ci); }; });
  var on = box.querySelector('.cmd-i.on'); if (on && on.scrollIntoView) on.scrollIntoView({block:'nearest'});
}
function cmdRun(i){ var it = CMD.items[i]; if (!it) return; CMD.open = false; cmdRender(); sIn.value = ''; sIn.blur(); it.a(); }

/* ---------- Router (#name) ---------- */
var mem = 'start', pending = [];
function after(fn){ pending.push(fn); }
try { localStorage.removeItem('jc-scope'); } catch(e){}
function cur(){ try { var h = location.hash.replace(/^#/,''); return h || mem; } catch(e){ return mem; } }
function go(r){ mem = r; try { if (location.hash !== '#'+r) { location.hash = r; return; } } catch(e){} render(); }
function render(keepScroll){
  window.JCLANG = state.lang;
  var r = cur(), html; pending = [];
  if (r==='start' || r==='') html = vCockpit();
  else if (r.indexOf('kat-')===0) html = vCat(r.slice(4));
  else if (r.indexOf('b-')===0) html = vItem(r.slice(2));
  else if (r.indexOf('tab-')===0) html = vTables(r.slice(4));
  else if (r==='mess') html = vMess();
  else if (r==='mess-neu') html = vMessForm();
  else if (r==='systemtests') html = vSystemtests();
  else if (r==='dtc') html = vDtc();
  else if (r==='import') html = vImport();
  else if (r==='oszi') html = vOszi();
  else if (r==='obd') html = vObd();
  else if (r==='diag') html = vDiag();
  else if (r==='diag-bericht') html = vDiagReport();
  else if (r==='berichte') html = vBerichte();
  else if (r==='fz') html = vAkte('');
  else if (r.indexOf('fz-')===0) html = vAkte(r.slice(3));
  else if (r.indexOf('bericht-')===0) { var ar = state.archiv.find(function(x){ return x.id===r.slice(8); }); html = ar ? vDiagReport(ar, true) : vNotFound(); }
  else if (r==='rechner') html = vCalc();
  else if (r==='merkliste') html = vFav();
  else if (r==='quellen') html = vAbout();
  else if (r==='suche') html = state.q.length>=2 ? vSearch(state.q) : vHome();
  else html = vNotFound();
  var y = window.scrollY;
  main.innerHTML = html;
  if (state.diag && r!=='diag' && r!=='diag-bericht' && r!=='berichte') main.insertAdjacentHTML('afterbegin', '<div class="wrap" style="padding-bottom:0">'+diagBanner()+'</div>');
  pending.forEach(function(fn){ try { fn(); } catch(e){ console.error(e); } }); pending = [];
  window.scrollTo(0, keepScroll===true ? y : 0);
  renderSide(r); renderBottom(r); renderQuick(r); closeNav();
  var t = main.querySelector('h1'); document.title = (t && r!=='start' ? t.textContent + ' · ' : '') + 'JC Diagnose';
}
window.addEventListener('hashchange', function(){ state.repEdit = false; render(); });

/* ---------- Kopfzeile ---------- */
var sIn = $('#search'), sT;
sIn.addEventListener('input', function(){ clearTimeout(sT); sT = setTimeout(function(){ CMD.items = cmdBuild(sIn.value); CMD.sel = 0; CMD.open = true; cmdRender(); }, 120); });
sIn.addEventListener('focus', function(){ if (sIn.value.trim()){ CMD.items = cmdBuild(sIn.value); CMD.open = true; cmdRender(); } });
sIn.addEventListener('blur', function(){ setTimeout(function(){ CMD.open = false; cmdRender(); }, 150); });
sIn.addEventListener('keydown', function(e){
  if (e.key==='Escape'){ sIn.value=''; CMD.open = false; cmdRender(); sIn.blur(); return; }
  if (e.key==='ArrowDown'){ e.preventDefault(); CMD.sel = Math.min(CMD.items.length-1, CMD.sel+1); cmdRender(); }
  else if (e.key==='ArrowUp'){ e.preventDefault(); CMD.sel = Math.max(0, CMD.sel-1); cmdRender(); }
  else if (e.key==='Enter'){ e.preventDefault(); if (!CMD.items.length) CMD.items = cmdBuild(sIn.value); cmdRun(CMD.sel); }
});
document.addEventListener('keydown', function(e){ var a = document.activeElement.tagName; if (e.key==='/' && a!=='INPUT' && a!=='SELECT' && a!=='TEXTAREA'){ e.preventDefault(); sIn.focus(); } });
var nt = $('#navToggle'), scrim = $('#scrim');
function closeNav(){ side.classList.remove('open'); scrim.hidden = true; nt.setAttribute('aria-expanded','false'); }
nt.addEventListener('click', function(){ var o = !side.classList.contains('open'); side.classList.toggle('open', o); scrim.hidden = !o; nt.setAttribute('aria-expanded', String(o)); });
scrim.addEventListener('click', closeNav);
$('#themeToggle').addEventListener('click', function(e){
  e.stopPropagation();
  var old = $('#skinMenu'); if (old){ old.remove(); return; }
  var m = document.createElement('div'); m.id = 'skinMenu'; m.className = 'skin-menu'; m.setAttribute('role','menu');
  m.innerHTML = '<div class="skin-head">'+T('Aussehen','Оформление')+'</div>' + SKINS.map(function(k){ return '<button role="menuitemradio" aria-checked="'+(k.id===state.skin)+'" data-skin="'+k.id+'"><span class="skin-dot" style="background:'+k.dot+'"></span>'+esc(T(k.de,k.ru))+(k.id===state.skin?'<span class="skin-ok">✓</span>':'')+'</button>'; }).join('');
  var inPrev = false; try { inPrev = window.parent !== window && /vorschau\.html$/.test(window.parent.location.pathname); } catch(e){}
  if (!inPrev) m.innerHTML += '<a class="skin-prev" href="vorschau.html">'+T('Vorschau Telefon & Tablet →','Предпросмотр телефон и планшет →')+'</a>';
  document.body.appendChild(m);
  m.querySelectorAll('[data-skin]').forEach(function(b){ b.onclick = function(){ state.skin = b.dataset.skin; lset('jc-skin', state.skin); applySkin(); m.remove(); render(true); }; });
  setTimeout(function(){ document.addEventListener('click', function close(ev){ if (!m.contains(ev.target)) { m.remove(); } document.removeEventListener('click', close); }); }, 0);
});
function applyLang(){
  document.documentElement.lang = state.lang;
  $('#langDe').setAttribute('aria-pressed', state.lang==='de'); $('#langRu').setAttribute('aria-pressed', state.lang==='ru');
  sIn.placeholder = T('Code, Kennzeichen, Bauteil oder Befehl – z. B. P0118, F-AB 123, NTC, obd','Код, госномер, компонент или команда — напр. P0118, F-AB 123, NTC, obd');
  sIn.setAttribute('aria-label', T('Suche','Поиск'));
  $('#brandSub').textContent = T('Datenbank & Messprotokoll','База и журнал замеров');
  $('#skipLink').textContent = T('Zum Inhalt springen','К содержимому');
}
function setLang(l){ state.lang = l; lset('jc-lang', l); applyLang(); render(true); }
$('#langDe').onclick = function(){ setLang('de'); };
$('#langRu').onclick = function(){ setLang('ru'); };
applyLang();
render();
})();
