/* JC Diagnose · Herstellerdaten (Mode 22 / 21) aus OBDb – https://github.com/OBDb, Lizenz CC BY-SA 4.0.
   Lädt je Marke eine Datei obdx/<Marke>.js (window.OBDX[marke] = {c:[befehle], m:{modell:[indizes]}}),
   liest die Werte über ELM327 (11 Bit, BMW-Erweiterung 6F1, 29 Bit 18DAxxF1) und rechnet sie nach der OBDb-Formel um. */
(function(){
'use strict';
var base = (function(){ var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^\/]*$/, '') : 'obdx/'; })();
var loading = {};
function loadScript(src){
  if (loading[src]) return loading[src];
  loading[src] = new Promise(function(res, rej){ var s = document.createElement('script'); s.src = src; s.onload = function(){ res(); }; s.onerror = function(){ delete loading[src]; rej(new Error('Datei fehlt: '+src)); }; document.head.appendChild(s); });
  return loading[src];
}
function index(){ return window.OBDXI ? Promise.resolve(window.OBDXI) : Promise.all([loadScript(base+'index.js'), loadScript(base+'lang.js')]).then(function(){ return window.OBDXI; }); }
function load(make){
  return index().then(function(ix){ var e = ix[make]; if (!e) throw new Error('Keine Daten für '+make);
    if (window.OBDX && window.OBDX[make]) return window.OBDX[make];
    return loadScript(base+e.f+'.js').then(function(){ return window.OBDX[make]; }); });
}
// Marke aus der VIN-Erkennung der App → OBDb-Marken
var VINMAP = {'BMW/MINI':['BMW','Mini'],'SEAT/Cupra':['Seat','Cupra'],'Opel/Vauxhall':['Opel'],'Citroën/DS':['Citroen','DS'],'Toyota/Lexus':['Toyota','Lexus'],'Chrysler/Dodge':['Chrysler','Dodge','Ram'],'Nissan':['Nissan','Infiniti','NissanInfiniti']};
function makesForVin(m){ if (!m) return []; return VINMAP[m] || [m]; }

function yearOk(f, y){
  if (!f || !y) return true;
  var ok = false;
  if (f.from != null && f.to != null){ ok = f.from <= f.to ? (y >= f.from && y <= f.to) : (y >= f.from || y <= f.to); }
  else if (f.to != null) ok = y <= f.to; else if (f.from != null) ok = y >= f.from;
  if (f.years && f.years.indexOf(y) >= 0) ok = true;
  if (f.from == null && f.to == null && !f.years) ok = true;
  return ok;
}
// Befehle eines Modells (mit Baujahr-Filter). Zeile: [hdr, rax, svc+pid, extra, signale]
function commands(data, model, year){
  var ids = data.m[model] || [], out = [];
  ids.forEach(function(i){ var c = data.c[i]; if (yearOk(c[3].f, year)) out.push({i:i, hdr:c[0], rax:c[1], req:c[2], ex:c[3], sig:c[4]}); });
  return out;
}

// ---- Umrechnung nach OBDb (Bits MSB zuerst, optional Bytes umgedreht) ----
function bits(data, bix, len, blsb){
  var d = data.slice(), i;
  if (blsb && len > 8){ var sb = bix >> 3, n = (len + 7) >> 3; var part = d.slice(sb, sb+n).reverse(); for (i = 0; i < part.length; i++) d[sb+i] = part[i]; }
  if (bix + len > d.length * 8) return null;
  var v = 0; for (i = bix; i < bix + len; i++){ v = v * 2 + ((d[i >> 3] >> (7 - (i & 7))) & 1); }
  return v;
}
var BOOL = {offon:['aus','an','выкл','вкл'], onoff:['an','aus','вкл','выкл'], noyes:['nein','ja','нет','да'], yesno:['ja','nein','да','нет']};
function decode(f, data, ru){
  var bix = f.bix || 0, len = f.len;
  if (f.unit === 'ascii'){ var s = ''; for (var k = bix >> 3; k < Math.min(data.length, (bix + len) >> 3); k++) if (data[k] >= 32 && data[k] < 127) s += String.fromCharCode(data[k]); return {txt:s.trim() || '–'}; }
  var raw = bits(data, bix, len, f.blsb); if (raw == null) return null;
  if (f.map){ var m = f.map[String(raw)]; return {txt:m != null ? m : String(raw), raw:raw}; }
  if (f.unit === 'hex') return {txt:raw.toString(16).toUpperCase(), raw:raw};
  if (BOOL[f.unit]){ var b = BOOL[f.unit]; return {txt:raw ? b[ru?3:1] : b[ru?2:0], v:raw, raw:raw}; }
  if (f.sign && raw >= Math.pow(2, len - 1)) raw -= Math.pow(2, len);
  var v = raw * (f.mul != null ? f.mul : 1) / (f.div != null ? f.div : 1) + (f.add || 0);
  var mn = f.min != null ? f.min : 0; if (f.max > mn) v = Math.max(mn, Math.min(v, f.max));
  if (f.nullmin != null && v <= f.nullmin) return {txt:'–', nul:true};
  if (f.nullmax != null && v >= f.nullmax) return {txt:'–', nul:true};
  var warn = (f.omin != null && v < f.omin) || (f.omax != null && v > f.omax);
  return {v:v, warn:warn, raw:raw};
}
function unit(f){ var U = (window.OBDXL && window.OBDXL.U) || {}; return f.unit in U ? U[f.unit] : (BOOL[f.unit] || f.map || f.unit === 'hex' || f.unit === 'ascii' ? '' : (f.unit || '')); }
function fmtNum(v){ var a = Math.abs(v); var s = a >= 1000 ? v.toFixed(0) : a >= 100 ? v.toFixed(1) : a >= 10 ? v.toFixed(2) : v.toFixed(3); s = s.replace(/\.?0+$/, ''); return s.replace('.', ','); }
// Name übersetzen: feste Wendungen zuerst, dann Wort für Wort
function name(n, ru){
  var L = window.OBDXL; if (!L) return n;
  var s = ' '+String(n).toLowerCase()+' ', k = ru ? 1 : 0, out = [];
  Object.keys(L.P).sort(function(a, b){ return b.length - a.length; }).forEach(function(p){ var re = new RegExp('(^|[^a-z])'+p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')+'(?=[^a-z]|$)', 'g'); s = s.replace(re, '$1\u0001'+L.P[p][k].replace(/ /g, '\u0002')+'\u0001'); });
  s.trim().split(/\s+/).forEach(function(w){
    if (w.charAt(0) === '\u0001'){ out.push(w.replace(/\u0001/g, '').replace(/\u0002/g, ' ')); return; }
    var m = /^([^a-z]*)([a-z]+)([^a-z]*)$/.exec(w);
    if (!m){ out.push(w.replace(/\u0001/g, '').replace(/\u0002/g, ' ')); return; }
    var t = L.W[m[2]]; if (t && t[k] === '') return;
    out.push(m[1] + (t ? t[k] : m[2]) + m[3]);
  });
  var r = out.join(' ').replace(/\s+/g, ' ').trim(); return r ? r.charAt(0).toUpperCase() + r.slice(1) : n;
}
function group(p, ru){ var L = window.OBDXL, g = String(p||'').split('.')[0]; return (L && L.G[g]) ? L.G[g][ru?1:0] : (g || (ru ? 'Прочее' : 'Sonstiges')); }

// ---- Adressierung → Steuergerät für JCECU ----
function ecuOf(c){
  if (c.hdr === '6F1' && c.ex.eax) return {req:c.ex.eax, res:c.rax || ('6'+c.ex.eax), mode:'bmw'};
  if (c.hdr.length === 4 && c.hdr.indexOf('DA') === 0) return {req:c.hdr.slice(2), res:'', mode:'29'};
  return {req:c.hdr, res:c.rax || '', mode:'11'};
}
function supported(c){ return (c.hdr.length === 3 && (!c.ex.eax || c.hdr === '6F1')) || (c.hdr.length === 4 && c.hdr.indexOf('DA') === 0 && !c.ex.eax); }
function ecuLabel(c){ var e = ecuOf(c); return e.mode === 'bmw' ? '6F1→'+e.req : e.mode === '29' ? '18DA'+e.req+'F1' : e.req+(e.res ? '/'+e.res : ''); }

// Liest die Befehle cmds (je mit .sig) und liefert [{c, ok, data|nrc|err}]
async function read(io, cmds, onProg){
  var E = window.JCECU, out = [];
  if (!E) throw new Error('Steuergeräte-Modul fehlt');
  await E.begin(io);
  try {
    for (var i = 0; i < cmds.length; i++){
      if (io.closed) break;
      var c = cmds[i], ecu = ecuOf(c), r;
      if (onProg) onProg(i, cmds.length, c);
      try {
        if (c.ex.din) await E.rawReq(io, ecu, '10'+c.ex.din, 3000);
        r = await E.rawReq(io, ecu, c.req, 4000);
        if (c.ex.dout) await E.rawReq(io, ecu, '10'+c.ex.dout, 3000);
      } catch(e){ out.push({c:c, err:(e && e.message) || String(e)}); continue; }
      var svc = parseInt(c.req.slice(0, 2), 16), skip = c.req.length / 2;
      if (r.ok && r.bytes[0] === svc + 0x40) out.push({c:c, ok:true, data:r.bytes.slice(skip)});
      else if (r.neg) out.push({c:c, nrc:r.nrc, text:r.text});
      else out.push({c:c, none:true, raw:r.raw || r.hex || ''});
    }
  } finally { await E.end(io); }
  return out;
}

// ---- Demo: beantwortet 22/21-Anfragen der geladenen Marke mit plausiblen Werten ----
var ds = {sh:null, cea:null, make:null};
function setDemo(make){ ds.make = make; }
function hx(n){ return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
function demo(c){
  if (c.indexOf('ATSH') === 0){ ds.sh = c.slice(4); return null; }
  if (c.indexOf('ATCEA') === 0){ ds.cea = c.slice(5) || null; return null; }
  if (!ds.make || !window.OBDX || !window.OBDX[ds.make] || !/^(22[0-9A-F]{4}|21[0-9A-F]{2})$/.test(c)) return null;
  var D = window.OBDX[ds.make], hit = null;
  for (var i = 0; i < D.c.length && !hit; i++){ var r = D.c[i]; if (r[2] !== c) continue;
    var cc = {hdr:r[0], rax:r[1], ex:r[3]}, e = ecuOf(cc);
    var sh = e.mode === 'bmw' ? '6F1' : e.mode === '29' ? 'DA'+e.req+'F1' : e.req;
    if (sh === ds.sh && (e.mode !== 'bmw' || ds.cea === e.req)) hit = r; }
  if (!hit) return null;
  var len = 0; hit[4].forEach(function(s){ var f = s[2]; len = Math.max(len, (f.bix || 0) + f.len); });
  var data = new Array(Math.ceil(len / 8)).fill(0), t = Date.now() / 1000;
  hit[4].forEach(function(s, k){ var f = s[2], mn = f.min != null ? f.min : 0, mx = f.max != null ? f.max : 1, raw;
    if (f.map){ var keys = Object.keys(f.map); raw = +keys[0] || 0; }
    else { var lo = f.omin != null ? f.omin : mn + (mx - mn) * 0.3, hi = f.omax != null ? f.omax : mn + (mx - mn) * 0.6;
      if (f.omin == null && f.unit === 'celsius'){ lo = 20; hi = 90; } else if (f.omin == null && f.unit === 'volts' && mx > 16 && mn < 12){ lo = 12.2; hi = 14.4; } else if (f.omin == null && f.unit === 'percent'){ lo = 40; hi = 90; }
      lo = Math.max(mn, Math.min(lo, mx)); hi = Math.max(mn, Math.min(hi, mx));
      var v = lo + (hi - lo) * (0.5 + 0.4 * Math.sin(t / 3 + k)); raw = Math.round((v - (f.add || 0)) * (f.div != null ? f.div : 1) / (f.mul != null ? f.mul : 1)); }
    var maxr = Math.pow(2, f.len) - 1; if (raw < 0) raw = f.sign ? raw + maxr + 1 : 0; raw = Math.max(0, Math.min(maxr, raw));
    for (var b = 0; b < f.len; b++){ var bit = Math.floor(raw / Math.pow(2, f.len - 1 - b)) % 2, pos = (f.bix || 0) + b; if (bit) data[pos >> 3] |= 1 << (7 - (pos & 7)); } });
  var bytes = [parseInt(c.slice(0, 2), 16) + 0x40].concat(c.slice(2).match(/../g).map(function(x){ return parseInt(x, 16); }), data);
  if (ds.sh === '6F1') bytes = [0xF1].concat(bytes);
  var h = function(a){ return a.map(hx).join(''); };
  if (bytes.length <= 7) return h(bytes);
  var s = ('00' + bytes.length.toString(16).toUpperCase()).slice(-3), n = 0; for (var j = 0; j < bytes.length; j += 7) s += '\n'+(n++ % 16).toString(16).toUpperCase()+':'+h(bytes.slice(j, j+7));
  return s;
}

window.JCOBDX = {index:index, load:load, makesForVin:makesForVin, commands:commands, decode:decode, unit:unit, fmtNum:fmtNum, name:name, group:group, read:read, ecuOf:ecuOf, ecuLabel:ecuLabel, supported:supported, yearOk:yearOk, demo:demo, setDemo:setDemo, bits:bits};
})();
