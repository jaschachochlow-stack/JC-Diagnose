/* JC Diagnose · Oszilloskop live (WebUSB)
   Treiber: Hantek 1008/1008C (USB 0783:5725) – Protokoll nach mfg92/hantek1008py (Apache-2.0),
   nach JavaScript/WebUSB portiert. Dazu ein Demo-Gerät mit künstlichen Kfz-Signalen.
   Wird von app.js mit window.JCScope(api) eingebunden. */
(function(){
'use strict';
window.JCScope = function(A){
var T = A.T, esc = A.esc;
var COL = ['#f5d90a','#2ee6c7','#ff5d9e','#5aa9ff','#ff8a3d','#b69cff','#7ee36b','#e8e8e8'];
var DIVX = 10, DIVY = 8;
var SEQ = [1,2,5];
function seq(lo, hi){ var out = []; for (var e=-7; e<3; e++) SEQ.forEach(function(m){ var v = +(m*Math.pow(10,e)).toPrecision(3); if (v>=lo-1e-12 && v<=hi+1e-12) out.push(v); }); return out; }
var TB_BURST = seq(10e-6, 0.2);           // 10 µs … 200 ms/div (Gerät: Block-Modus)
var TB_ROLL = [0.5,1,2,5,10,20,50];        // s/div (Gerät: Roll-Modus)
var VDIVS = seq(0.005, 200);
var PROBES = [
  {id:'x1', f:1, u:'V', de:'Tastkopf 1:1', ru:'Щуп 1:1'},
  {id:'x10', f:10, u:'V', de:'Tastkopf 10:1', ru:'Щуп 10:1'},
  {id:'x20', f:20, u:'V', de:'Abschwächer 20:1', ru:'Делитель 20:1'},
  {id:'a100', f:10, u:'A', de:'Stromzange 100 mV/A', ru:'Клещи 100 мВ/А'},
  {id:'a10', f:100, u:'A', de:'Stromzange 10 mV/A', ru:'Клещи 10 мВ/А'},
  {id:'a1', f:1000, u:'A', de:'Stromzange 1 mV/A', ru:'Клещи 1 мВ/А'}
];
function probe(id){ return PROBES.find(function(p){ return p.id===id; }) || PROBES[0]; }
function fmtSI(v, unit, dig){
  if (v==null || !isFinite(v)) return '–';
  var a = Math.abs(v), p = [[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n']];
  for (var i=0;i<p.length;i++){ if (a >= p[i][0]*0.9995 || i===p.length-1){ var n = v/p[i][0]; return (+n.toPrecision(dig||3)).toLocaleString(A.state.lang==='ru'?'ru-RU':'de-DE') + ' ' + p[i][1] + unit; } }
}
function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function hex(u8){ return Array.prototype.map.call(u8, function(b){ return ('0'+b.toString(16)).slice(-2); }).join(''); }

/* ---------- Einstellungen ---------- */
function defCh(i){ return {on:i<2, vdiv:i<2?2:1, off:i===0?1.5:(i===1?-2.5:0), probe:'x1', ac:false}; }
var S = A.lget('jc-scope', null);
if (!S || !S.ch || S.ch.length!==8) S = {ch:[0,1,2,3,4,5,6,7].map(defCh), tdiv:0.01, roll:false, rollT:1, trig:{src:0, slope:'rise', level:2.5, mode:'auto'}, sel:0, preset:'', comp:'', cal:1};
if (!S.cal) S.cal = 1;
function save(){ A.lset('jc-scope', S); }

/* ---------- Laufzeit ---------- */
var R = {drv:null, running:false, single:false, frame:null, roll:null, dirty:true, log:[], err:'', status:'', cursor:false, cur:[null,null], ref:true, busy:false, loopId:0};
function log(s){ var t = new Date(); R.log.push(('0'+t.getMinutes()).slice(-2)+':'+('0'+t.getSeconds()).slice(-2)+'.'+('00'+t.getMilliseconds()).slice(-3)+'  '+s); if (R.log.length>600) R.log.splice(0, R.log.length-600); }

/* ---------- Hantek 1008C über WebUSB ---------- */
var VS = [0.02, 0.125, 1.0];                       // Hardware-Bereiche: ±0,41 V, ±2,56 V, ±20,5 V am Eingang
var ROLL_RATES = [[440,0x18],[220,0x19],[88,0x1a],[44,0x1b],[22,0x1c],[11,0x1d],[5,0x1e],[2,0x1f],[1,0x20]];
var RATE_F = [4.56, 3.03, 2.27, 1.82, 1.51, 1.3, 1.14, 1.00];
function nsId(ns){ var best = 0, bd = 1e99; for (var id=0; id<26; id++){ var v = [1,2,5][id%3]*Math.pow(10, Math.floor(id/3)); var d = Math.abs(Math.log(v/ns)); if (d<bd){ bd = d; best = id; } } return best; }
function Hantek(dev){ this.dev = dev; this.name = 'Hantek 1008C'; this.zero = null; this.vs = [1,1,1,1,1,1,1,1]; this.act = [0,1,2,3,4,5,6,7]; this.inRoll = false; this.hw = true; }
Hantek.prototype.open = async function(){
  var d = this.dev;
  log('USB: '+(d.manufacturerName||'?')+' / '+(d.productName||'?')+' · VID '+d.vendorId.toString(16)+' PID '+d.productId.toString(16));
  await d.open();
  if (!d.configuration) await d.selectConfiguration(1);
  var itf = d.configuration.interfaces[0];
  await d.claimInterface(itf.interfaceNumber);
  var eps = itf.alternate.endpoints;
  log('Interface '+itf.interfaceNumber+' · Endpunkte: '+eps.map(function(e){ return e.direction+e.endpointNumber+'/'+e.type+'/'+e.packetSize; }).join(', '));
  this.epOut = eps.find(function(e){ return e.direction==='out'; }).endpointNumber;
  this.epIn = eps.find(function(e){ return e.direction==='in'; }).endpointNumber;
};
Hantek.prototype.cmd = async function(id, param, respLen, echo, waitResp, waitStart){
  param = param || []; respLen = respLen || 0; if (echo===undefined) echo = true;
  if (waitStart!==0) await sleep(waitStart==null ? 2 : waitStart);
  var msg = new Uint8Array([id].concat(Array.prototype.slice.call(param)));
  await this.dev.transferOut(this.epOut, msg);
  if (waitResp) await sleep(waitResp);
  var want = respLen + (echo ? 1 : 0);
  var self = this, r = await Promise.race([this.dev.transferIn(this.epIn, 64), sleep(2500).then(function(){ return null; })]);
  if (!r) { log('! Zeitüberschreitung bei Befehl '+hex([id])); throw new Error(T('Gerät antwortet nicht','Прибор не отвечает')+' ('+hex([id])+')'); }
  var b = new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength);
  if (this.verbose) log('> '+hex(msg)+'  < '+hex(b));
  if (b.length < want) log('! kurze Antwort auf '+hex([id])+': '+b.length+'/'+want+' Byte');
  if (echo && b[0]!==id) log('! Echo erwartet '+hex([id])+', erhalten '+hex(b.slice(0,1)));
  void self;
  return b.slice(echo?1:0, want);
};
Hantek.prototype.ping = function(ws){ return this.cmd(0xf3, [], 0, true, 0, ws==null?0:ws); };
Hantek.prototype.c6a6 = async function(p){
  var r = await this.cmd(0xc6, [p], 2, false); var len = (r[0]<<8)|r[1], out = new Uint8Array(len), n = Math.ceil(len/64), o = 0;
  for (var i=0;i<n;i++){ var part = await this.cmd(0xa6, [p], 64, false); out.set(part.slice(0, Math.min(64, len-o)), o); o += 64; }
  return out;
};
Hantek.prototype.a55a = async function(max){
  for (var i=0;i<max;i++){ var r = await this.cmd(0xa5, [0x5a], 1); if (r[0]===2 || r[0]===3) return true; await sleep(20); await this.ping(); if (!R.running && !R.single) return false; }
  return false;
};
Hantek.prototype.setActive = async function(chs){ this.act = chs.slice().sort(); await this.cmd(0xa0, [chs.length]); await this.cmd(0xaa, [0,1,2,3,4,5,6,7].map(function(i){ return chs.indexOf(i)>=0 ? 1 : 0; })); };
Hantek.prototype.setVS = async function(arr){ this.vs = arr.slice(); await this.cmd(0xa2, arr.map(function(v){ return VS.indexOf(v)+1; }), 0, true, 214); };
Hantek.prototype.setTime = function(sec){ return this.cmd(0xa3, [nsId(sec*1e9)]); };
Hantek.prototype.setTrig = async function(ch, slope, raw){ await this.cmd(0xc1, [ch, slope==='fall'?1:0]); raw = Math.max(0, Math.min(4095, Math.round(raw))); await this.cmd(0xab, [raw>>8, raw&255]); };
Hantek.prototype.init = async function(){
  log('Initialisierung …');
  await this.cmd(0xb0); await sleep(700); await this.cmd(0xb0); await this.ping();
  await this.cmd(0xb9, [0x01, 0xb0, 0x04, 0x00, 0x00]);                 // Generator-Takt (Standard)
  await this.cmd(0xb7, [0x00]); await this.cmd(0xbb, [0x08, 0x00]);       // Generator aus
  await this.cmd(0xb5, [], 64, false, 19); await this.cmd(0xb6, [], 64, false);
  var id = await this.cmd(0xe5, [], 2, false); log('Kennung e5: '+hex(id)+(hex(id)==='d606'?' (wie bekannt)':' (abweichend – bitte Log senden)'));
  await this.cmd(0xf7, [], 64, false); await this.cmd(0xf8, [], 64, false); await this.cmd(0xfa, [], 56, false);
  await this.cmd(0xf5, [], 0, true, 214);
  await this.setActive([0,1,2,3,4,5,6,7]); await this.setTime(500e-6); await this.cmd(0xc1, [0, 0]);
  await this.cmd(0xa7, [0, 0], 1); await this.cmd(0xac, [0x01,0xf4,0x00,0x09,0xc5,0x00,0x09,0xc5]);
  // Nullpunkte je Bereich messen (Eingänge sollten dabei offen oder auf Masse sein)
  this.zero = {};
  for (var k=0;k<3;k++){
    await this.ping(); await this.setVS([VS[k],VS[k],VS[k],VS[k],VS[k],VS[k],VS[k],VS[k]]);
    await this.cmd(0xa4, [0x01]); await this.cmd(0xc0); await sleep(12); await this.cmd(0xc2);
    await this.a55a(30);
    var raw = concat(await this.c6a6(2), await this.c6a6(3)), sh = shorts(raw), z = [];
    for (var c=0;c<8;c++){ var s = 0, n = 0; for (var i=c;i<sh.length;i+=8){ s += sh[i]; n++; } z.push(n ? s/n : 2048); }
    this.zero[VS[k]] = z; log('Nullpunkt '+VS[k]+': '+z.map(function(v){ return v.toFixed(0); }).join(' '));
  }
  await this.cmd(0xf6, [], 0, true, 214);
  await this.cmd(0xe5, [], 2, false); await this.cmd(0xf7, [], 64, false); await this.cmd(0xf8, [], 64, false); await this.cmd(0xfa, [], 56, false);
  await this.setTime(500e-6); await this.cmd(0xac, [0x00,0xc8,0x00,0x02,0xbd,0x00,0x02,0xbd]);
  await this.cmd(0xe4, [0x01]); await this.cmd(0xe6, [0x01], 10, false); await this.ping();
  this.ready = true; log('Gerät bereit.');
};
function concat(a, b){ var o = new Uint8Array(a.length+b.length); o.set(a); o.set(b, a.length); return o; }
function shorts(u8){ var o = new Uint16Array(u8.length>>1); for (var i=0;i<o.length;i++) o[i] = u8[2*i] | (u8[2*i+1]<<8); return o; }
function hwRange(ch){ var p = probe(ch.probe), need = (Math.abs(ch.off)+4.2)*ch.vdiv/p.f; for (var i=0;i<VS.length;i++) if (2048*0.01*VS[i] >= need) return VS[i]; return 1.0; }
Hantek.prototype.apply = async function(){
  if (this.inRoll){ await this.ping(); this.inRoll = false; }
  var act = []; S.ch.forEach(function(c, i){ if (c.on) act.push(i); }); if (!act.length) act = [0];
  var vs = S.ch.map(hwRange);
  await this.ping(); await this.setActive(act); await this.setVS(vs);
  if (!S.roll) await this.setTime(S.tdiv);
  var tc = S.ch[S.trig.src], p = probe(tc.probe), zz = this.zero ? this.zero[vs[S.trig.src]][S.trig.src] : 2048;
  await this.setTrig(S.trig.src, S.trig.slope, zz + (S.trig.level/p.f)/(0.01*vs[S.trig.src]));
  await this.cmd(0xa7, [0, 0], 1); await this.cmd(0xac, [0,0,0,0,0x01,0x00,0x05,0x79]);
  log('Einstellung: Kanäle '+act.map(function(i){ return 'CH'+(i+1); }).join(',')+' · Bereiche '+vs.join('/')+' · '+(S.roll ? 'Roll '+S.rollT+' s/div' : fmtSI(S.tdiv,'s')+'/div'));
};
Hantek.prototype.toVolts = function(rawArr, ch){
  var vs = this.vs[ch], z = this.zero ? this.zero[vs][ch] : 2048, k = 0.01*vs*probe(S.ch[ch].probe).f, o = new Float32Array(rawArr.length);
  for (var i=0;i<rawArr.length;i++) o[i] = (rawArr[i]-z)*k; return o;
};
Hantek.prototype.split = function(sh, extra){
  var n = this.act.length + (extra?1:0), data = [null,null,null,null,null,null,null,null], self = this;
  this.act.forEach(function(ch, j){ var len = Math.floor((sh.length - j + n - 1)/n), a = new Array(len); for (var i=0;i<len;i++) a[i] = sh[j+i*n]; data[ch] = self.toVolts(a, ch); });
  return data;
};
Hantek.prototype.burst = async function(){
  await this.ping(); await this.cmd(0xe4, [0x01]); await this.cmd(0xe6, [0x01], 10, false);
  await this.cmd(0xa4, [0x01], 0, true, 15); await this.cmd(0xc0); await this.cmd(0xc2);
  var ok = await this.a55a(S.trig.mode==='auto' ? 12 : 400);
  if (!ok && S.trig.mode!=='auto') return null;
  if (!ok) log('kein Trigger – Auto-Aufnahme');
  var raw = concat(await this.c6a6(2), await this.c6a6(3));
  var data = this.split(shorts(raw), false), dt = S.tdiv / (25 * RATE_F[this.act.length-1]) / S.cal;
  return {dt:dt, data:data, trig:ok};
};
Hantek.prototype.rollStart = async function(){
  var need = 40/S.rollT, rate = ROLL_RATES[0]; for (var i=ROLL_RATES.length-1;i>=0;i--){ if (ROLL_RATES[i][0] >= need){ rate = ROLL_RATES[i]; break; } }
  this.rollRate = rate[0]; await this.cmd(0xa3, [rate[1]]); await this.ping(10); await this.cmd(0xa4, [0x02]); await this.cmd(0xc0); await this.cmd(0xc2);
  this.inRoll = true; log('Roll-Modus '+rate[0]+' Werte/s je Kanal');
};
Hantek.prototype.rollRead = async function(){
  await this.ping(); var r = await this.cmd(0xc7, [], 2, false), len = (r[0]<<8)|r[1];
  if (!len) { await sleep(25); return null; }
  var buf = new Uint8Array(len), o = 0;
  while (o < len){ var part = await this.cmd(0xc8, [], 64, false); buf.set(part.slice(0, Math.min(64, len-o)), o); o += 64; }
  return {dt:1/this.rollRate, data:this.split(shorts(buf), true)};
};
Hantek.prototype.close = async function(){ try { await this.ping(); await this.cmd(0xf4); } catch(e){} try { await this.dev.close(); } catch(e){} };

/* ---------- Demo-Gerät ---------- */
function Demo(){ this.name = T('Demo-Oszilloskop','Демо-осциллограф'); this.hw = false; this.t = 0; }
var SIG = {
  hall: function(t){ var r = (t*50)%1; return r<0.5 ? 0.3 : 4.9; },
  inductive: function(t){ var x = (t*1500/60*60)%1, tooth = Math.sin(2*Math.PI*x); var gap = ((t*25)%1) < 0.03; return (gap ? 0.15 : 1)*tooth*(2.5 + 0.4*Math.sin(t*3)); },
  cam: function(t){ var r = (t*12.5)%1; return (r>0.1 && r<0.35) || (r>0.6 && r<0.7) ? 4.9 : 0.2; },
  inj: function(t){ var r = (t*10)%1, ms = r*100; if (ms < 3) return 0.6 + ms*0.15; if (ms < 3.15) return 62*Math.exp(-(ms-3)*25); if (ms < 3.6) return 13.4 + 6*Math.exp(-(ms-3.15)*12); return 13.8; },
  coil: function(t){ var ms = ((t*25)%1)*40; return ms < 3.2 ? 0 : (ms < 6.2 ? (ms-3.2)*2.5 : 0); },
  lambda: function(t){ var x = Math.sin(2*Math.PI*t*1.2); return 0.45 + 0.38*Math.tanh(4*x); },
  crankv: function(t){ var x = (t%8); if (x<1) return 12.6; if (x<1.05) return 12.6 - (x-1)*100; if (x<2.6) return 9.9 + 0.5*Math.sin(2*Math.PI*x*8); if (x<3) return 13.2; return 14.2; },
  pwm: function(t){ return ((t*100)%1) < 0.35 ? 0.4 : 13.8 + (((t*100)%1)<0.37 ? 25 : 0); },
  maf: function(t){ var x = t%6; return x<2 ? 1.1 : (x<2.4 ? 1.1+(x-2)*8 : 4.3 - (x-2.4)*0.9 > 1.1 ? 4.3-(x-2.4)*0.9 : 1.1); },
  ntc: function(t){ return 0.6 + 2.4*Math.exp(-t/60); },
  alt: function(t){ return 14.1 + 0.08*Math.abs(Math.sin(2*Math.PI*t*450)); },
  can: function(t, ch){ var bit = Math.floor(t*500000), dom = ((bit*2654435761)>>>0)%3===0; return ch ? (dom ? 1.5 : 2.5) : (dom ? 3.5 : 2.5); },
  freq: function(t){ return ((t*2600)%1) < 0.5 ? 0.2 : 4.9; },
  knock: function(t){ var r = (t*25)%1; return r<0.08 ? 1.2*Math.sin(2*Math.PI*t*7000)*Math.exp(-r*40) : 0.03*Math.sin(t*9000); },
  pump: function(t){ return 4.5 + 0.9*Math.abs(Math.sin(2*Math.PI*t*110)); },
  ramp: function(t){ var x = (t%6)/3; return 0.5 + 4*(x<1 ? x : 2-x); },
  comp: function(t){ var r = (t*1000)%1; return r<0.5 ? 0 : 2; }
};
var DEMO_MAP = {inductive:['inductive'], hall:['hall'], direction:['hall'], sync:['inductive','cam'], vvt:['inductive','cam','pwm'], ramp:['ramp'], dual:['ramp','ramp2'], pedal:['ramp','ramp2'], maf:['maf'], freq:['freq'], map:['ramp'], fp:['freq'], rail:['maf'], lambda:['lambda'], wide:['lambda'], heater:['pwm'], knock:['knock'], ntc:['ntc'], egt:['ntc'], inj:['inj'], gdi:['coil'], cr:['coil'], coil:['coil'], absind:['inductive'], absact:['hall'], ak:['hall'], gear:['hall','hall2'], pwm:['pwm'], pump:['pump'], clamp:['pump'], drop:['crankv'], crankv:['crankv'], relcomp:['pump'], cyl:['lambda'], exhaust:['lambda'], alt:['alt'], can:['can','canl'], lin:['pwm'], sent:['freq'], psi:['hall']};
Demo.prototype.sig = function(ch, t){
  var m = DEMO_MAP[S.preset] || ['hall','inductive','cam','inj','pwm','lambda','coil','comp'], k = m[ch] || m[0];
  if (k==='ramp2') return 5 - SIG.ramp(t) + 0.0;
  if (k==='hall2') return SIG.hall(t*1.37);
  if (k==='canl') return SIG.can(t, 1);
  return (SIG[k] || SIG.hall)(t, 0);
};
Demo.prototype.open = async function(){ log('Demo-Gerät verbunden'); };
Demo.prototype.init = async function(){ this.ready = true; };
Demo.prototype.apply = async function(){ log('Demo: Einstellung übernommen'); };
Demo.prototype.burst = async function(){
  await sleep(60); var n = 600, span = S.tdiv*DIVX*1.3, dt = span/n, t0 = this.t + Math.random()*0.5, data = [], self = this;
  // wie ein echtes Gerät: auf das Triggerereignis warten (max. 2 s Signalzeit absuchen)
  var tc = S.ch[S.trig.src], L = S.trig.level, sdt = Math.min(dt, 2e-5), prev = this.sig(S.trig.src, t0);
  if (tc && tc.on && !tc.ac) for (var tt = t0 + sdt; tt < t0 + 2; tt += sdt){ var cv = this.sig(S.trig.src, tt); if ((S.trig.slope==='rise' && prev < L && cv >= L) || (S.trig.slope==='fall' && prev > L && cv <= L)){ t0 = tt - span*0.2; break; } prev = cv; }
  S.ch.forEach(function(c, i){ if (!c.on) { data.push(null); return; } var a = new Float32Array(n), u = probe(c.probe).u==='A' ? 1 : 1; for (var j=0;j<n;j++) a[j] = (self.sig(i, t0 + j*dt) + (Math.random()-0.5)*0.03*Math.max(0.2, c.vdiv))*u; data.push(a); });
  this.t += 0.37; return {dt:dt, data:data, trig:true};
};
Demo.prototype.rollStart = async function(){ this.rt = performance.now()/1000; this.rate = Math.min(440, 60/S.rollT*4); };
Demo.prototype.rollRead = async function(){
  await sleep(50); var now = performance.now()/1000, n = Math.max(1, Math.floor((now - this.rt)*this.rate)), dt = 1/this.rate, data = [], self = this, t0 = this.rt;
  this.rt += n*dt;
  S.ch.forEach(function(c, i){ if (!c.on) { data.push(null); return; } var a = new Float32Array(n); for (var j=0;j<n;j++) a[j] = self.sig(i, t0 + j*dt) + (Math.random()-0.5)*0.02; data.push(a); });
  return {dt:dt, data:data};
};
Demo.prototype.close = async function(){};

/* ---------- Verbinden ---------- */
function usbWhy(){
  if (!('usb' in navigator)) return /iPhone|iPad|iPod/.test(navigator.userAgent) ? T('iPhone/iPad erlauben keinen USB-Zugriff aus dem Browser.','iPhone/iPad не дают браузеру доступ к USB.') : T('Dieser Browser kann kein WebUSB. Bitte Chrome oder Edge (Android, PC, Mac) verwenden.','Этот браузер не умеет WebUSB. Нужен Chrome или Edge (Android, ПК, Mac).');
  if (!window.isSecureContext) return T('USB geht nur, wenn die App über https geöffnet ist (z. B. GitHub Pages).','USB работает, только если приложение открыто по https (например, GitHub Pages).');
  return '';
}
async function connect(kind){
  if (R.busy) return; R.err = ''; R.busy = true; R.status = T('verbinde …','подключаюсь …'); redraw();
  try {
    await disconnect(true);
    var drv;
    if (kind==='demo') drv = new Demo();
    else {
      var why = usbWhy(); if (why) throw new Error(why);
      var dev = null, list = await navigator.usb.getDevices();
      dev = list.find(function(d){ return d.vendorId===0x0783 && d.productId===0x5725; });
      if (!dev) dev = await navigator.usb.requestDevice({filters:[{vendorId:0x0783, productId:0x5725}]});
      drv = new Hantek(dev);
    }
    R.drv = drv; await drv.open(); R.status = T('initialisiere …','инициализация …'); redraw();
    await drv.init(); R.dirty = true; R.status = ''; R.running = true; loop();
    A.toast(drv.name+' '+T('verbunden','подключён'));
  } catch(e){
    R.drv = null; R.status = ''; var m = (e && e.message) || String(e);
    if (e && e.name==='NotFoundError') m = T('Kein Gerät ausgewählt. Ist der 1008C per OTG-Kabel angesteckt?','Прибор не выбран. 1008C подключён через OTG-кабель?');
    else if (e && (e.name==='SecurityError' || /claim|Access denied/i.test(m))) m += ' · '+T('Andere App (z. B. HScope) schließen und Stecker neu einstecken.','Закрой другое приложение (например, HScope) и переподключи кабель.');
    R.err = m; log('Fehler: '+m);
  }
  R.busy = false; redraw();
}
async function disconnect(silent){
  R.running = false; R.single = false; R.loopId++;
  var d = R.drv; R.drv = null; if (d) { try { await d.close(); } catch(e){} log('getrennt'); }
  if (!silent) redraw();
}
if ('usb' in navigator) navigator.usb.addEventListener('disconnect', function(e){ if (R.drv && R.drv.dev === e.device){ R.drv = null; R.running = false; R.err = T('USB-Gerät wurde abgezogen.','USB-прибор отключён.'); log('USB getrennt'); redraw(); } });

/* ---------- Mess-Schleife ---------- */
async function loop(){
  var my = ++R.loopId;
  while (R.drv && (R.running || R.single) && my===R.loopId){
    var d = R.drv;
    try {
      if (R.dirty){ R.dirty = false; await d.apply(); R.roll = null; if (S.roll) await d.rollStart(); }
      if (S.roll){
        var c = await d.rollRead(); if (my!==R.loopId) break;
        if (c) addRoll(c);
      } else {
        var f = await d.burst(); if (my!==R.loopId) break;
        if (f){ R.frame = f; if (R.single){ R.single = false; R.running = false; } }
      }
      draw();
    } catch(e){ R.err = (e && e.message) || String(e); log('Fehler: '+R.err); R.running = false; R.single = false; redraw(); break; }
    await new Promise(function(r){ requestAnimationFrame(function(){ r(); }); });
  }
}
function addRoll(c){
  var max = Math.ceil(S.rollT*DIVX/c.dt);
  if (!R.roll || Math.abs(R.roll.dt-c.dt)>1e-12) R.roll = {dt:c.dt, data:[null,null,null,null,null,null,null,null]};
  c.data.forEach(function(a, i){ if (!a) { R.roll.data[i] = null; return; } var old = R.roll.data[i] || new Float32Array(0), n = Math.min(max, old.length + a.length), o = new Float32Array(n), keep = n - a.length;
    if (keep > 0) o.set(old.subarray(old.length-keep)); o.set(a.length > n ? a.subarray(a.length-n) : a, Math.max(0, keep)); R.roll.data[i] = o; });
}
function cfgChanged(){ save(); R.dirty = true; if (R.drv && !R.running && !R.single) { /* Einstellung beim nächsten Start */ } draw(); }

/* ---------- Auswertung ---------- */
function measure(a, dt){
  if (!a || a.length < 4) return null;
  var mx = -1e9, mn = 1e9, s = 0, s2 = 0, n = a.length;
  for (var i=0;i<n;i++){ var v = a[i]; if (v>mx) mx = v; if (v<mn) mn = v; s += v; s2 += v*v; }
  var avg = s/n, rms = Math.sqrt(s2/n), pp = mx - mn, mid = (mx+mn)/2, hy = pp*0.1, st = a[0] > mid, rise = [], fall = [];
  if (pp > 1e-6) for (var j=1;j<n;j++){ if (!st && a[j] > mid+hy){ st = true; rise.push(j); } else if (st && a[j] < mid-hy){ st = false; fall.push(j); } }
  var per = null, duty = null;
  if (rise.length >= 2){ per = (rise[rise.length-1]-rise[0])/(rise.length-1)*dt;
    var hi = 0, cnt = 0; for (var k=0;k<rise.length-1;k++){ var f = fall.find(function(x){ return x>rise[k] && x<rise[k+1]; }); if (f!=null){ hi += (f-rise[k]); cnt += rise[k+1]-rise[k]; } } duty = cnt ? hi/cnt*100 : null; }
  return {max:mx, min:mn, pp:pp, avg:avg, rms:rms, per:per, f:per ? 1/per : null, duty:duty, cyc:rise.length ? rise.length-1 : 0};
}
function view(){
  // liefert {dt, data, i0} – sichtbarer Ausschnitt mit Software-Trigger
  if (S.roll){ if (!R.roll) return null; return {dt:R.roll.dt, data:R.roll.data, i0:0, span:S.rollT*DIVX, rollMode:true}; }
  var f = R.frame; if (!f) return null;
  var span = S.tdiv*DIVX, need = Math.round(span/f.dt), src = f.data[S.trig.src], pre = Math.round(need*0.2), i0 = 0, trig = false;
  if (src){ var L = S.trig.level, ac = S.ch[S.trig.src].ac ? mean(src) : 0;
    for (var i=Math.max(1,pre); i<src.length; i++){ var p = src[i-1]-ac, q = src[i]-ac; if ((S.trig.slope==='rise' && p < L && q >= L) || (S.trig.slope==='fall' && p > L && q <= L)){ i0 = i - pre; trig = true; break; } } }
  return {dt:f.dt, data:f.data, i0:i0, span:span, trig:trig || f.trig};
}
function mean(a){ var s = 0; for (var i=0;i<a.length;i++) s += a[i]; return a.length ? s/a.length : 0; }

/* ---------- Zeichnen ---------- */
function draw(){
  var cv = document.getElementById('scv'); if (!cv) return;
  var dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  if (cv.width !== Math.round(W*dpr) || cv.height !== Math.round(H*dpr)){ cv.width = Math.round(W*dpr); cv.height = Math.round(H*dpr); }
  var g = cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  g.fillStyle = '#0b1a2c'; g.fillRect(0,0,W,H);
  var gx = W/DIVX, gy = H/DIVY;
  g.strokeStyle = '#1b3a5c'; g.lineWidth = 1; g.beginPath();
  for (var i=1;i<DIVX;i++){ g.moveTo(Math.round(i*gx)+0.5,0); g.lineTo(Math.round(i*gx)+0.5,H); }
  for (var j=1;j<DIVY;j++){ g.moveTo(0,Math.round(j*gy)+0.5); g.lineTo(W,Math.round(j*gy)+0.5); }
  g.stroke();
  g.strokeStyle = '#2b5785'; g.beginPath(); g.moveTo(0,Math.round(H/2)+0.5); g.lineTo(W,Math.round(H/2)+0.5); g.moveTo(Math.round(W/2)+0.5,0); g.lineTo(Math.round(W/2)+0.5,H); g.stroke();
  var v = view();
  // Kanäle
  S.ch.forEach(function(c, i){
    if (!c.on) return;
    var y0 = H/2 - c.off*gy;
    g.fillStyle = COL[i]; g.beginPath(); g.moveTo(0, y0-6); g.lineTo(9, y0); g.lineTo(0, y0+6); g.fill();
    if (!v || !v.data[i]) return;
    var a = v.data[i], ac = c.ac ? mean(a) : 0, dt = v.dt, i0 = v.i0, n = Math.round(v.span/dt);
    var start = v.rollMode ? Math.max(0, a.length - n) : i0, cnt = Math.min(n, a.length - start);
    g.strokeStyle = COL[i]; g.lineWidth = i===S.sel ? 1.8 : 1.3; g.beginPath();
    var step = Math.max(1, Math.floor(cnt / (W*2)));
    for (var k=0;k<cnt;k+=step){ var x = (v.rollMode ? (n - cnt + k) : k)*dt/v.span*W, y = y0 - (a[start+k]-ac)/c.vdiv*gy; if (y < -2000) y = -2000; if (y > H+2000) y = H+2000; if (k===0) g.moveTo(x,y); else g.lineTo(x,y); }
    g.stroke();
  });
  // Trigger
  if (!S.roll){ var tc = S.ch[S.trig.src]; if (tc.on){ var ty = H/2 - tc.off*gy - S.trig.level/tc.vdiv*gy; g.fillStyle = COL[S.trig.src]; g.beginPath(); g.moveTo(W, ty-6); g.lineTo(W-9, ty); g.lineTo(W, ty+6); g.fill();
    var tx = W*0.2; g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(tx,0); g.lineTo(tx,H); g.stroke(); g.setLineDash([]); } }
  // Cursor
  if (R.cursor) R.cur.forEach(function(cx, k){ if (cx==null) return; g.strokeStyle = k ? '#ff8a3d' : '#7ee36b'; g.setLineDash([6,4]); g.beginPath(); g.moveTo(cx*W,0); g.lineTo(cx*W,H); g.stroke(); g.setLineDash([]); g.fillStyle = g.strokeStyle; g.font = '600 12px system-ui,sans-serif'; g.fillText(k?'B':'A', cx*W+4, 14); });
  // Statuszeile
  g.font = '600 12px ui-monospace,Menlo,monospace'; g.fillStyle = '#d5e4ef';
  var st = !R.drv ? T('KEIN GERÄT','НЕТ ПРИБОРА') : (R.running ? (S.roll ? 'ROLL' : (v && v.trig ? 'TRIG\'D' : 'AUTO')) : 'STOP');
  g.fillText(st+'  '+(S.roll ? S.rollT+' s/div' : fmtSI(S.tdiv,'s')+'/div'), 8, H-8);
  if (!v && R.drv && R.running) { g.fillStyle = '#8fb3d6'; g.fillText(T('warte auf Daten …','жду данные …'), W/2-60, H/2-12); }
  if (!R.drv){ g.fillStyle = '#8fb3d6'; g.font = '14px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(T('Oszilloskop verbinden oder Demo starten','Подключи осциллограф или запусти демо'), W/2, H/2-14); g.textAlign = 'left'; }
  readout(v);
}
function readout(v){
  var box = document.getElementById('scMeas'); if (!box) return;
  var rows = [];
  S.ch.forEach(function(c, i){ if (!c.on) return; var p = probe(c.probe), u = p.u, a = v && v.data[i];
    var m = null; if (a){ var n = Math.round(v.span/v.dt), st = v.rollMode ? Math.max(0, a.length-n) : v.i0; m = measure(a.subarray ? a.subarray(st, st+n) : a.slice(st, st+n), v.dt); }
    rows.push('<tr'+(i===S.sel?' class="on"':'')+'><td><i style="background:'+COL[i]+'"></i>CH'+(i+1)+'</td><td>'+fmtSI(m&&m.f,'Hz')+'</td><td>'+(m&&m.duty!=null?fmtSI(m.duty,'%',3):'–')+'</td><td>'+fmtSI(m&&m.max,u)+'</td><td>'+fmtSI(m&&m.min,u)+'</td><td>'+fmtSI(m&&m.pp,u)+'</td><td>'+fmtSI(m&&m.avg,u)+'</td><td>'+fmtSI(m&&m.rms,u)+'</td></tr>');
    c._m = m; });
  var cur = '';
  if (R.cursor && R.cur[0]!=null && R.cur[1]!=null && v){ var span = v.span, dtc = Math.abs(R.cur[1]-R.cur[0])*span, c0 = S.ch[S.sel], vals = [0,1].map(function(k){ var a = v.data[S.sel]; if (!a) return null; var n = Math.round(span/v.dt), st = v.rollMode ? Math.max(0,a.length-n) : v.i0, idx = st + Math.round(R.cur[k]*n); return idx<a.length ? a[idx] : null; });
    cur = '<p class="sc-cur">Δt = <b>'+fmtSI(dtc,'s')+'</b> · 1/Δt = <b>'+fmtSI(dtc?1/dtc:null,'Hz')+'</b> · CH'+(S.sel+1)+': A '+fmtSI(vals[0], probe(c0.probe).u)+', B '+fmtSI(vals[1], probe(c0.probe).u)+', Δ '+fmtSI(vals[0]!=null&&vals[1]!=null?vals[1]-vals[0]:null, probe(c0.probe).u)+'</p>'; }
  box.innerHTML = rows.length ? '<div class="tbl sc-tbl"><table><thead><tr><th></th><th>'+T('Frequenz','Частота')+'</th><th>'+T('Tastgrad','Скважн.')+'</th><th>Max</th><th>Min</th><th>'+T('Spitze-Spitze','Размах')+'</th><th>'+T('Mittel','Среднее')+'</th><th>RMS</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>'+cur : '';
}

/* ---------- Voreinstellungen je Messaufgabe ---------- */
// ch: [vdiv, offset(div), probe, ac] · t: s/div (Block) oder roll: s/div · trig: [kanal, flanke, pegel]
var P = {
  inductive:{ch:[[2,0,'x1',1]], t:0.01, trig:[0,'rise',0.5]},
  hall:{ch:[[2,-2,'x1']], t:0.01, trig:[0,'rise',2.5]},
  direction:{ch:[[2,-2,'x1']], t:0.005, trig:[0,'rise',2.5]},
  sync:{ch:[[2,1.5,'x1',1],[2,-3,'x1']], t:0.02, trig:[1,'rise',2.5]},
  vvt:{ch:[[2,2,'x1',1],[2,-1,'x1'],[10,-3.5,'x1']], t:0.02, trig:[1,'rise',2.5]},
  ramp:{ch:[[1,-2.5,'x1']], roll:0.5},
  dual:{ch:[[1,-2.5,'x1'],[1,-2.5,'x1']], roll:0.5},
  pedal:{ch:[[1,-2.5,'x1'],[1,-2.5,'x1']], roll:1},
  maf:{ch:[[1,-2.5,'x1']], roll:0.5},
  freq:{ch:[[2,-2,'x1']], t:0.0005, trig:[0,'rise',2.5]},
  map:{ch:[[1,-2.5,'x1']], roll:0.5},
  fp:{ch:[[2,-2,'x1']], t:0.002, trig:[0,'rise',2.5]},
  rail:{ch:[[1,-2.5,'x1']], roll:1},
  lambda:{ch:[[0.2,-2.5,'x1']], roll:1},
  wide:{ch:[[0.5,-3,'x1']], roll:1},
  heater:{ch:[[5,-3,'x1']], t:0.05, trig:[0,'fall',6]},
  knock:{ch:[[0.5,0,'x1',1]], t:0.01, trig:[0,'rise',0.3]},
  ntc:{ch:[[1,-2.5,'x1']], roll:10},
  egt:{ch:[[1,-2.5,'x1']], roll:10},
  inj:{ch:[[10,-3,'x10']], t:0.002, trig:[0,'fall',6]},
  gdi:{ch:[[5,-3,'a10']], t:0.001, trig:[0,'rise',2]},
  cr:{ch:[[5,-3,'a10']], t:0.001, trig:[0,'rise',2]},
  coil:{ch:[[2,-3,'a100']], t:0.002, trig:[0,'rise',1]},
  absind:{ch:[[0.5,0,'x1',1]], t:0.01, trig:[0,'rise',0.1]},
  absact:{ch:[[0.5,-2,'x1']], t:0.01, trig:[0,'rise',1]},
  ak:{ch:[[0.5,-2,'x1']], t:0.002, trig:[0,'rise',1]},
  gear:{ch:[[2,1,'x1'],[2,-3,'x1']], t:0.01, trig:[0,'rise',2.5]},
  pwm:{ch:[[5,-3,'x1']], t:0.01, trig:[0,'fall',6]},
  pump:{ch:[[2,-3,'a100']], t:0.01, trig:[0,'rise',4]},
  clamp:{ch:[[5,-3,'a10']], t:0.02, trig:[0,'rise',2]},
  drop:{ch:[[0.2,-3,'x1']], roll:0.5},
  crankv:{ch:[[2,-3,'x1']], roll:0.5},
  relcomp:{ch:[[100,-3,'a1']], t:0.2, trig:[0,'rise',100]},
  cyl:{ch:[[1,-3,'x1']], t:0.02, trig:[0,'rise',1]},
  exhaust:{ch:[[0.5,0,'x1',1]], t:0.1, trig:[0,'rise',0.1]},
  alt:{ch:[[0.1,0,'x1',1]], t:0.002, trig:[0,'rise',0.02]},
  can:{ch:[[1,-1,'x1'],[1,-1,'x1']], t:0.00002, trig:[0,'rise',3]},
  lin:{ch:[[5,-3,'x1']], t:0.002, trig:[0,'fall',6]},
  sent:{ch:[[2,-2,'x1']], t:0.0005, trig:[0,'fall',2.5]},
  psi:{ch:[[2,-2,'x1']], t:0.0001, trig:[0,'rise',2.5]}
};
var NOTE = {
  inj:['Spannungsspitze bis ca. 60–80 V: Tastkopf 10:1 verwenden, 1008C-Eingang nicht direkt anschließen.','Пик до ~60–80 В: только щуп 10:1, не подключать вход 1008C напрямую.'],
  gdi:['Nur Stromzange! Direkteinspritzer arbeiten mit bis zu 65–90 V.','Только токовые клещи! Непосредственный впрыск — до 65–90 В.'],
  can:['Der 1008C tastet mit max. 2,4 MS/s ab – für CAN reicht das nur für Pegel und grobe Form, nicht für einzelne Bits.','1008C даёт максимум 2,4 МВыб/с — для CAN видно только уровни и общую форму, не отдельные биты.'],
  alt:['AC-Kopplung erfolgt in der Software; Auflösung im ±20-V-Bereich ca. 10 mV.','AC-связь программная; разрешение в диапазоне ±20 В около 10 мВ.'],
  psi:['PSI5/Airbag: nur nach Herstellerverfahren messen, Zündpillen niemals messen.','PSI5/подушки: только по методике производителя, пиропатроны не измерять.'],
  coil:['Primärspannung (bis 400 V) nur mit passendem Abschwächer messen – hier Strom per Zange.','Первичное напряжение (до 400 В) — только с подходящим делителем; здесь ток клещами.'],
  relcomp:['Hochstromzange (1 mV/A); Einspritzung/Zündung abschalten.','Клещи на большой ток (1 мВ/А); отключить впрыск/зажигание.']
};
function applyPreset(k){
  var p = P[k]; S.preset = k; if (!p) { save(); return; }
  S.ch = [0,1,2,3,4,5,6,7].map(function(i){ var c = p.ch[i], d = defCh(i); d.on = !!c; if (c){ d.vdiv = c[0]; d.off = c[1]; d.probe = c[2]; d.ac = !!c[3]; } return d; });
  if (p.roll){ S.roll = true; S.rollT = p.roll; } else { S.roll = false; S.tdiv = p.t; }
  if (p.trig) S.trig = {src:p.trig[0], slope:p.trig[1], level:p.trig[2], mode:S.trig.mode||'auto'};
  S.sel = 0; R.frame = null; R.roll = null; cfgChanged();
}
function autoSet(){
  var v = view(); if (!v){ A.toast(T('Erst Daten aufnehmen','Сначала нужны данные')); return; }
  var per = null;
  S.ch.forEach(function(c, i){ var a = v.data[i]; if (!c.on || !a) return; var m = measure(a, v.dt); if (!m) return;
    var target = (m.pp||0.1)/5.5, vd = VDIVS.find(function(x){ return x >= target; }) || VDIVS[VDIVS.length-1]; c.vdiv = vd; c.off = c.ac ? 0 : Math.max(-3.5, Math.min(3.5, -(m.max+m.min)/2/vd));
    if (i===S.trig.src){ S.trig.level = c.ac ? 0 : +(((m.max+m.min)/2).toPrecision(3)); }
    if (m.per && (per==null || i===S.trig.src)) per = m.per; });
  if (per && !S.roll){ var want = per*3/DIVX, tb = TB_BURST.find(function(x){ return x >= want; }); if (tb) S.tdiv = tb; }
  cfgChanged(); A.toast(T('Auto-Setup: ca. 3 Perioden im Bild','Автонастройка: ~3 периода на экране'));
}

/* ---------- Speichern ---------- */
function snapshot(){
  var cv = document.getElementById('scv'); if (!cv) return Promise.resolve(null);
  return new Promise(function(res){ cv.toBlob(function(b){ res(b); }, 'image/png'); });
}
function summary(){
  var out = [];
  S.ch.forEach(function(c, i){ if (!c.on) return; var m = c._m, u = probe(c.probe).u; out.push('CH'+(i+1)+' ('+fmtSI(c.vdiv,u)+'/div, '+T(probe(c.probe).de, probe(c.probe).ru)+(c.ac?', AC':'')+')'+(m?': f '+fmtSI(m.f,'Hz')+(m.duty!=null?', '+T('Tastgrad ','скважность ')+fmtSI(m.duty,'%',3):'')+', max '+fmtSI(m.max,u)+', min '+fmtSI(m.min,u)+', Vpp '+fmtSI(m.pp,u)+', '+T('Mittel ','среднее ')+fmtSI(m.avg,u):'')); });
  return out.join('\n');
}
async function toProtocol(){
  var b = await snapshot(); if (!b){ A.toast(T('Kein Bild','Нет изображения')); return; }
  var ph; try { ph = await A.PH.add(b); } catch(e){ A.toast(T('Bild konnte nicht gespeichert werden','Не удалось сохранить картинку')); return; }
  ph.cap = T('Oszilloskop','Осциллограф')+(R.drv?' · '+R.drv.name:'');
  var w = A.OSZ.waves[S.preset], tn = w ? (A.state.lang==='ru'?w.ru.n:w.de.n) : '';
  var m0 = S.ch[S.sel] && S.ch[S.sel]._m;
  A.startDraft({comp:S.comp||'', punkt:tn, mittel:'Oszilloskop', vdiv:S.ch.filter(function(c){return c.on;}).map(function(c){ return fmtSI(c.vdiv, probe(c.probe).u); }).join(' / '), tdiv:S.roll ? (S.rollT*1000)+'' : String(+(S.tdiv*1000).toPrecision(3)), trigger:S.roll ? 'Roll' : 'CH'+(S.trig.src+1)+' '+(S.trig.slope==='rise'?'↑':'↓')+' '+fmtSI(S.trig.level, probe(S.ch[S.trig.src].probe).u), herkunft:1, notiz:summary(), photos:[ph], _added:[ph.id], ist:m0 && m0.f ? +m0.f.toPrecision(4) : '', einheit:m0 && m0.f ? 'Hz' : ''});
}
function csv(){
  var v = view(); if (!v){ A.toast(T('Keine Daten','Нет данных')); return; }
  var chs = []; S.ch.forEach(function(c, i){ if (c.on && v.data[i]) chs.push(i); });
  var n = Math.min.apply(null, chs.map(function(i){ return v.data[i].length; })), lines = ['t_s;'+chs.map(function(i){ return 'CH'+(i+1)+'_'+probe(S.ch[i].probe).u; }).join(';')];
  for (var k=0;k<n;k++) lines.push((k*v.dt).toPrecision(6)+';'+chs.map(function(i){ return v.data[i][k].toFixed(4); }).join(';'));
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n').replace(/\./g, ',')], {type:'text/csv'})); a.download = 'oszi-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.csv'; a.click();
}
async function png(){ var b = await snapshot(); if (!b) return; var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'oszi-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.png'; a.click(); }

/* ---------- Ansicht ---------- */
function presetOptions(){
  var groups = {}; Object.keys(A.OSZ.waves).forEach(function(k){ var w = A.OSZ.waves[k]; (groups[w.g] = groups[w.g] || []).push(k); });
  return '<option value="">'+T('– Messaufgabe wählen –','– что измеряем –')+'</option>'+Object.keys(groups).map(function(g){ return '<optgroup label="'+esc(T(g, A.GROUP_RU[g]||g))+'">'+groups[g].map(function(k){ var w = A.OSZ.waves[k]; return '<option value="'+k+'"'+(S.preset===k?' selected':'')+'>'+esc(A.state.lang==='ru'?w.ru.n:w.de.n)+'</option>'; }).join('')+'</optgroup>'; }).join('');
}
function chChip(i){ var c = S.ch[i]; return '<button class="sc-ch'+(c.on?' on':'')+(S.sel===i?' sel':'')+'" data-ch="'+i+'" style="--c:'+COL[i]+'"><b>CH'+(i+1)+'</b><span>'+(c.on ? fmtSI(c.vdiv, probe(c.probe).u)+'/div'+(c.ac?' AC':'') : T('aus','выкл'))+'</span></button>'; }
function panel(){
  var c = S.ch[S.sel], u = probe(c.probe).u;
  return '<div class="sc-panel" style="--c:'+COL[S.sel]+'"><div class="sc-ph"><b>CH'+(S.sel+1)+'</b><label class="sc-sw"><input type="checkbox" id="scOn"'+(c.on?' checked':'')+'> '+T('ein','вкл')+'</label></div>' +
    '<div class="sc-row"><span>'+T('Volt/Div','Вольт/дел')+'</span><button class="btn small" data-k="vd-">−</button><b class="mono">'+fmtSI(c.vdiv,u)+'</b><button class="btn small" data-k="vd+">+</button></div>' +
    '<div class="sc-row"><span>'+T('Lage','Смещение')+'</span><button class="btn small" data-k="of-">▼</button><b class="mono">'+c.off.toFixed(1)+' div</b><button class="btn small" data-k="of+">▲</button><button class="btn small" data-k="of0">0</button></div>' +
    '<div class="sc-row"><span>'+T('Messmittel','Щуп')+'</span><select id="scProbe">'+PROBES.map(function(p){ return '<option value="'+p.id+'"'+(c.probe===p.id?' selected':'')+'>'+esc(T(p.de,p.ru))+'</option>'; }).join('')+'</select></div>' +
    '<div class="sc-row"><span>'+T('Kopplung','Связь')+'</span><button class="btn small'+(c.ac?'':' primary')+'" data-k="dc">DC</button><button class="btn small'+(c.ac?' primary':'')+'" data-k="ac">AC</button></div></div>';
}
function trigPanel(){
  var tc = S.ch[S.trig.src], u = probe(tc.probe).u;
  return '<div class="sc-panel"><div class="sc-ph"><b>'+T('Trigger','Запуск')+'</b></div>' +
    '<div class="sc-row"><span>'+T('Quelle','Источник')+'</span><select id="scTsrc">'+[0,1,2,3,4,5,6,7].map(function(i){ return '<option value="'+i+'"'+(S.trig.src===i?' selected':'')+'>CH'+(i+1)+'</option>'; }).join('')+'</select><button class="btn small'+(S.trig.slope==='rise'?' primary':'')+'" data-k="rise">↑</button><button class="btn small'+(S.trig.slope==='fall'?' primary':'')+'" data-k="fall">↓</button></div>' +
    '<div class="sc-row"><span>'+T('Pegel','Уровень')+'</span><button class="btn small" data-k="tl-">−</button><b class="mono">'+fmtSI(S.trig.level,u)+'</b><button class="btn small" data-k="tl+">+</button><button class="btn small" data-k="tl50">50 %</button></div>' +
    '<div class="sc-row"><span>'+T('Modus','Режим')+'</span><button class="btn small'+(S.trig.mode==='auto'?' primary':'')+'" data-k="auto">Auto</button><button class="btn small'+(S.trig.mode==='normal'?' primary':'')+'" data-k="normal">Normal</button></div></div>';
}
function body(){
  var why = usbWhy(), con = R.drv;
  var w = A.OSZ.waves[S.preset], note = NOTE[S.preset];
  var h = '<div class="sc-top"><div class="sc-conn'+(con?' on':'')+'"><i></i>'+(con ? esc(con.name) : (R.status ? esc(R.status) : T('nicht verbunden','не подключён')))+'</div>' +
    (con ? '<button class="btn small" data-k="disc">'+T('Trennen','Отключить')+'</button>' : '<button class="btn primary small" data-k="usb"'+(R.busy?' disabled':'')+'>'+T('Hantek 1008C (USB)','Hantek 1008C (USB)')+'</button><button class="btn small" data-k="demo"'+(R.busy?' disabled':'')+'>'+T('Demo','Демо')+'</button>') +
    '<select id="scPreset" aria-label="'+T('Messaufgabe','Что измеряем')+'">'+presetOptions()+'</select></div>' +
    (R.err ? '<p class="sc-err">'+esc(R.err)+'</p>' : '') + (!con && why ? '<p class="note">'+esc(why)+'</p>' : '') +
    (note ? '<p class="note sc-warn">'+esc(T(note[0], note[1]))+'</p>' : '') +
    '<div class="sc-screen"><canvas id="scv" aria-label="'+T('Oszilloskop-Bild','Экран осциллографа')+'"></canvas></div>' +
    '<div class="sc-bar">' +
      '<button class="btn small'+(R.running&&!R.single?' primary':'')+'" data-k="run">'+(R.running ? T('Stopp','Стоп') : T('Start','Пуск'))+'</button>' +
      '<button class="btn small" data-k="single"'+(S.roll?' disabled':'')+'>'+T('Einzeln','Однократно')+'</button>' +
      '<span class="sc-tb"><button class="btn small" data-k="tb-">−</button><b class="mono">'+(S.roll ? S.rollT+' s' : fmtSI(S.tdiv,'s'))+'/div</b><button class="btn small" data-k="tb+">+</button></span>' +
      '<button class="btn small'+(S.roll?' primary':'')+'" data-k="roll">Roll</button>' +
      '<button class="btn small" data-k="autoset">'+T('Auto-Setup','Автонастройка')+'</button>' +
      '<button class="btn small'+(R.cursor?' primary':'')+'" data-k="cursor">'+T('Cursor','Курсоры')+'</button></div>' +
    '<div class="sc-chs">'+[0,1,2,3,4,5,6,7].map(chChip).join('')+'</div>' +
    '<div id="scMeas"></div>' +
    '<div class="sc-panels">'+panel()+trigPanel()+'</div>' +
    '<div class="btn-row"><button class="btn primary" data-k="save">'+T('Ins Messprotokoll','В журнал замеров')+'</button><button class="btn" data-k="png">'+T('Bild speichern','Сохранить картинку')+'</button><button class="btn" data-k="csv">CSV</button></div>' +
    (w && R.ref ? '<h2>'+T('Sollbild zum Vergleich','Эталон для сравнения')+'</h2>'+A.waveBlock(S.preset, null) : '') +
    '<details class="sc-log"><summary>'+T('Verbindungsprotokoll','Журнал подключения')+' ('+R.log.length+')</summary><p class="muted">'+T('Wenn etwas nicht klappt: „Kopieren“ und an Claude schicken.','Если что-то не работает: «Скопировать» и отправить Claude.')+'</p><div class="btn-row"><button class="btn small" data-k="copylog">'+T('Kopieren','Скопировать')+'</button><label class="sc-sw"><input type="checkbox" id="scVerb"'+(R.drv&&R.drv.verbose?' checked':'')+'> '+T('alle USB-Befehle mitschreiben','писать все USB-команды')+'</label></div><pre id="scLogTxt">'+esc(R.log.slice(-200).join('\n'))+'</pre></details>' +
    '<p class="muted" style="font-size:var(--text-xs)">'+T('Hantek 1008C: Treiber auf Basis des offenen Projekts hantek1008py (Apache-2.0); nicht vom Hersteller. Bereiche ±0,4 / ±2,5 / ±20 V am Eingang, 8 Kanäle, max. 2,4 MS/s. Zeitachse lässt sich mit dem Kompensationsausgang (1 kHz) prüfen.','Hantek 1008C: драйвер на основе открытого проекта hantek1008py (Apache-2.0), не от производителя. Диапазоны ±0,4 / ±2,5 / ±20 В на входе, 8 каналов, до 2,4 МВыб/с. Ось времени можно проверить по выходу компенсации (1 кГц).')+
      ' <button class="btn small" data-k="cal">'+T('Zeitachse mit 1-kHz-Ausgang kalibrieren','Откалибровать время по выходу 1 кГц')+'</button></p>';
  return h;
}
function redraw(){
  var host = document.getElementById('scBody'); if (!host) return;
  var open = host.querySelector('.sc-log') && host.querySelector('.sc-log').open;
  host.innerHTML = body(); if (open) host.querySelector('.sc-log').open = true;
  bind(host); draw();
}
function step(arr, v, d){ var i = arr.findIndex(function(x){ return x >= v - 1e-12; }); if (i<0) i = arr.length-1; i = Math.max(0, Math.min(arr.length-1, i + d)); return arr[i]; }
function bind(host){
  host.querySelectorAll('[data-k]').forEach(function(b){ b.onclick = function(){ act(b.dataset.k); }; });
  host.querySelectorAll('[data-ch]').forEach(function(b){ b.onclick = function(){ var i = +b.dataset.ch; if (S.sel===i){ S.ch[i].on = !S.ch[i].on; cfgChanged(); } S.sel = i; save(); redraw(); }; });
  var ps = host.querySelector('#scPreset'); if (ps) ps.onchange = function(){ applyPreset(ps.value); redraw(); };
  var pr = host.querySelector('#scProbe'); if (pr) pr.onchange = function(){ S.ch[S.sel].probe = pr.value; cfgChanged(); redraw(); };
  var on = host.querySelector('#scOn'); if (on) on.onchange = function(){ S.ch[S.sel].on = on.checked; cfgChanged(); redraw(); };
  var ts = host.querySelector('#scTsrc'); if (ts) ts.onchange = function(){ S.trig.src = +ts.value; cfgChanged(); redraw(); };
  var vb = host.querySelector('#scVerb'); if (vb) vb.onchange = function(){ if (R.drv) R.drv.verbose = vb.checked; };
  var cv = host.querySelector('#scv'); if (!cv) return;
  var drag = null;
  cv.addEventListener('pointerdown', function(e){ var r = cv.getBoundingClientRect(), x = (e.clientX-r.left)/r.width;
    if (R.cursor){ var k = R.cur[0]==null ? 0 : (R.cur[1]==null ? 1 : (Math.abs(R.cur[0]-x) < Math.abs(R.cur[1]-x) ? 0 : 1)); R.cur[k] = x; drag = {cur:k}; draw(); }
    else drag = {y:e.clientY, off:S.ch[S.sel].off, h:r.height};
    cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function(e){ if (!drag) return; var r = cv.getBoundingClientRect();
    if (drag.cur!=null){ R.cur[drag.cur] = Math.max(0, Math.min(1, (e.clientX-r.left)/r.width)); draw(); }
    else { S.ch[S.sel].off = Math.max(-4, Math.min(4, Math.round((drag.off - (e.clientY-drag.y)/(drag.h/DIVY))*10)/10)); draw(); } });
  cv.addEventListener('pointerup', function(){ if (drag && drag.cur==null){ cfgChanged(); redraw(); } drag = null; });
}
async function act(k){
  var c = S.ch[S.sel];
  switch (k){
    case 'usb': connect('usb'); return;
    case 'demo': connect('demo'); return;
    case 'disc': await disconnect(); return;
    case 'run': if (!R.drv) return; if (R.running){ R.running = false; R.loopId++; } else { R.running = true; R.single = false; loop(); } break;
    case 'single': if (!R.drv) return; R.running = false; R.single = true; R.loopId++; R.dirty = true; loop(); break;
    case 'tb-': case 'tb+': var d = k==='tb+' ? 1 : -1; if (S.roll) S.rollT = step(TB_ROLL, S.rollT, d); else S.tdiv = step(TB_BURST, S.tdiv, d); cfgChanged(); break;
    case 'roll': S.roll = !S.roll; R.roll = null; R.frame = null; cfgChanged(); break;
    case 'autoset': autoSet(); break;
    case 'cursor': R.cursor = !R.cursor; R.cur = [null, null]; break;
    case 'vd-': c.vdiv = step(VDIVS, c.vdiv, -1); cfgChanged(); break;
    case 'vd+': c.vdiv = step(VDIVS, c.vdiv, 1); cfgChanged(); break;
    case 'of-': c.off = Math.max(-4, +(c.off-0.5).toFixed(1)); cfgChanged(); break;
    case 'of+': c.off = Math.min(4, +(c.off+0.5).toFixed(1)); cfgChanged(); break;
    case 'of0': c.off = 0; cfgChanged(); break;
    case 'dc': c.ac = false; cfgChanged(); break;
    case 'ac': c.ac = true; cfgChanged(); break;
    case 'rise': case 'fall': S.trig.slope = k; cfgChanged(); break;
    case 'tl-': case 'tl+': S.trig.level = +(S.trig.level + (k==='tl+'?1:-1)*S.ch[S.trig.src].vdiv/5).toPrecision(3); cfgChanged(); break;
    case 'tl50': var m = S.ch[S.trig.src]._m; if (m){ S.trig.level = S.ch[S.trig.src].ac ? 0 : +(((m.max+m.min)/2).toPrecision(3)); cfgChanged(); } break;
    case 'auto': case 'normal': S.trig.mode = k; cfgChanged(); break;
    case 'save': toProtocol(); return;
    case 'png': png(); return;
    case 'csv': csv(); return;
    case 'copylog': try { await navigator.clipboard.writeText(R.log.join('\n')); A.toast(T('Protokoll kopiert','Журнал скопирован')); } catch(e){ A.toast(T('Kopieren nicht möglich','Не удалось скопировать')); } return;
    case 'cal': calibrate(); return;
  }
  redraw();
}
function calibrate(){
  var v = view(), a = v && v.data[S.sel]; if (!a){ A.toast(T('Erst den Tastkopf an den 1-kHz-Ausgang, dann Start','Сначала щуп на выход 1 кГц, потом «Пуск»')); return; }
  var m = measure(a, v.dt); if (!m || !m.f){ A.toast(T('Keine Frequenz erkannt – Zeitbasis 0,5 ms/div wählen','Частота не найдена — поставь 0,5 мс/дел')); return; }
  var k = m.f/1000; if (k < 0.2 || k > 5){ A.toast(T('Gemessen ','Измерено ')+fmtSI(m.f,'Hz')+T(' – unplausibel, nicht übernommen',' — неправдоподобно, не принято')); return; }
  S.cal = S.cal * k; save(); log('Kalibrierung: gemessen '+m.f.toFixed(1)+' Hz → Faktor '+S.cal.toFixed(4)); A.toast(T('Zeitachse kalibriert','Ось времени откалибрована'));
}
var ro = null;
function vScope(){
  var h = '<div class="wrap sc">'+A.crumbs([T('Oszilloskop','Осциллограф')])+'<h1>'+T('Oszilloskop live','Осциллограф онлайн')+'</h1><div id="scBody">'+body()+'</div>'+A.foot()+'</div>';
  A.after(function(){ var host = document.getElementById('scBody'); bind(host); draw();
    if (ro) ro.disconnect(); if (window.ResizeObserver){ ro = new ResizeObserver(function(){ draw(); }); ro.observe(document.getElementById('scv')); }
    if (R.drv && !R.running && R.wasRunning){ R.running = true; R.wasRunning = false; loop(); } });
  return h;
}
window.addEventListener('hashchange', function(){ if (location.hash !== '#scope' && R.running){ R.wasRunning = true; R.running = false; R.loopId++; } });
return {
  view: vScope,
  open: function(kind, comp){ if (kind) applyPreset(kind); S.comp = comp || ''; save(); A.go('scope'); },
  connected: function(){ return !!R.drv; },
  name: function(){ return R.drv ? R.drv.name : ''; },
  _S: S, _R: R, _measure: measure
};
};
})();
