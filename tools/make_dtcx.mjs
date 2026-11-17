/* Baut dtcx/*.js aus OBDex (CC0-1.0, github.com/foerbsnavi/obdex): OBDEX=<Pfad zum Klon> node tools/make_dtcx.mjs (benötigt npm i yaml) */
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {parse} from 'yaml';
const fam={P0:'P0xxx',P2:'P2xxx',P3:'P3xxx',B0:'B0xxx',C0:'C0xxx',U0:'U0xxx',U3:'U3xxx'};
mkdirSync('dtcx',{recursive:true});
let tot=0, n=0;
for (const [k,f] of Object.entries(fam)){
  const arr=parse(readFileSync(`${process.env.OBDEX||'./obdex'}/data/generic/${f}_enriched.yaml`,'utf8'))||[];
  const out=arr.map(c=>{
    const o={c:c.code,t:c.title?.de||c.title?.en||'',e:c.title?.en||'',d:c.description?.de||'',
      u:(c.common_causes||[]).map(x=>[(x.likelihood||'m')[0],x.label?.de||x.label?.en||'']),
      s:(c.symptoms||[]).map(x=>x.de||x.en).filter(Boolean),
      k:(c.affected_components||[]).slice(0,6)};
    const r=c.repair; if(r) o.r=[r.difficulty||'',r.diy_possible?1:0,r.estimated_cost_eur||null,r.estimated_hours||null];
    const fl=c.flags||{}; o.f=(fl.mil?'M':'')+(fl.emissions_relevant?'E':'')+(fl.drive_cycle_required?'D':'')+(fl.limp_mode_possible?'L':'');
    if(c.related_codes?.length) o.x=c.related_codes.slice(0,8);
    return o;});
  const s=JSON.stringify(out); writeFileSync(`dtcx/${k}.js`,`window.DTCX=window.DTCX||{};DTCX.${k}=${s};\n`); n+=out.length; tot+=s.length;
  console.log(k,out.length,(s.length/1e6).toFixed(2)+'MB');
}
console.log('total',n,(tot/1e6).toFixed(1)+'MB');
