#!/usr/bin/env python3
"""Baut obdx/<Marke>.js aus OBDb-Signalsets (CC BY-SA 4.0, https://github.com/OBDb).
Aufruf: python3 tools/make_obdb.py <ordner-mit-REPO.json> <ziel-ordner>"""
import json, glob, os, sys, re, collections
src, out = sys.argv[1], sys.argv[2]
NORM = {'SEAT':'Seat','FIAT':'Fiat','VauxhallOpel':'Opel','MINI':'Mini','INFINITI':'Infiniti','Land':'Land Rover','Rolls':'Rolls-Royce','Mercedes':'Mercedes-Benz','smart':'Smart','Alfa':'Alfa Romeo','Aston':'Aston Martin'}
MULTI = {'Land':2,'Rolls':2,'Mercedes':2,'Alfa':2,'Aston':2}
makes = collections.defaultdict(lambda: {'m':{}, 'c':[], 'idx':{}})
for f in sorted(glob.glob(os.path.join(src, '*.json'))):
    repo = os.path.basename(f)[:-5]; parts = repo.split('-')
    k = MULTI.get(parts[0], 1); mk = NORM.get(parts[0], parts[0]); model = ' '.join(parts[k:]) or '*'
    try: d = json.load(open(f))
    except Exception: continue
    ids = []
    for c in d.get('commands', []):
        svc, pid = list(c['cmd'].items())[0]
        if svc == '01': continue
        p = c.get('proto', '')
        if p and not p.startswith('15765'): continue
        h = c['hdr']
        if not ((len(h) == 3 and ('eax' not in c or h == '6F1')) or (len(h) == 4 and h.startswith('DA') and 'eax' not in c)): continue
        sigs = []
        for s in c['signals']:
            if s.get('hidden'): continue
            fm = {k2:v for k2,v in s['fmt'].items() if k2 in ('bix','len','blsb','sign','min','max','add','mul','div','unit','nullmin','nullmax','omin','omax','map')}
            if 'map' in fm: fm['map'] = {k3:(v3['value'] if isinstance(v3, dict) else str(v3)) for k3,v3 in fm['map'].items()}
            sigs.append([s['name'], s.get('path',''), fm])
        if not sigs: continue
        ex = {k2:c[k2] for k2 in ('pri','din','dout','tst','fcm1','eax') if k2 in c}
        if 'filter' in c: ex['f'] = c['filter']
        row = [c['hdr'], c.get('rax',''), svc+pid, ex, sigs]
        key = json.dumps(row, sort_keys=True, separators=(',',':'))
        M = makes[mk]
        if key not in M['idx']: M['idx'][key] = len(M['c']); M['c'].append(row)
        ids.append(M['idx'][key])
    if ids: makes[mk]['m'][model] = sorted(set(ids))
os.makedirs(out, exist_ok=True)
index = {}
for mk, M in makes.items():
    if not M['m']: continue
    fn = re.sub(r'[^A-Za-z0-9]', '_', mk)
    data = {'c':M['c'], 'm':M['m']}
    js = '/* OBDb (https://github.com/OBDb) – CC BY-SA 4.0. Aufbereitet für JC Diagnose. */\n(window.OBDX=window.OBDX||{})['+json.dumps(mk)+']='+json.dumps(data, separators=(',',':'), ensure_ascii=False)+';\n'
    open(os.path.join(out, fn+'.js'), 'w').write(js)
    index[mk] = {'f':fn, 'n':sum(len(r[4]) for r in M['c']), 'models':sorted(M['m'].keys())}
open(os.path.join(out, 'index.js'), 'w').write('/* OBDb (https://github.com/OBDb) – CC BY-SA 4.0 */\nwindow.OBDXI='+json.dumps(index, separators=(',',':'), ensure_ascii=False)+';\n')
print(len(index), 'Marken', sum(len(v['models']) for v in index.values()), 'Modelle', sum(v['n'] for v in index.values()), 'Signale (dedupliziert)')
