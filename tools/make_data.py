"""Erzeugt app/data.js: Nachschlagewerk v9.3 + Excel V3.3 + russische Titel."""
import json, sys, os, openpyxl

src_js, xlsx, ru_titles, out = sys.argv[1:5]
fc_html = sys.argv[5] if len(sys.argv) > 5 else None
s = open(src_js, encoding='utf-8').read()
D = json.loads(s[s.index('{'):s.rindex('}') + 1])

ru = json.load(open(ru_titles, encoding='utf-8'))
assert len(ru) == len(D['items']) == 120
for it, t in zip(D['items'], ru):
    it['title_ru'] = t

CAT_RU = {
    'sensoren': ('Датчики', 'Двигатель, выхлоп, ходовая, комфорт'),
    'aktoren': ('Исполнительные механизмы', 'Клапаны, приводы, насосы, вентиляторы'),
    'bordnetz': ('Бортсеть и шины', 'АКБ 12 В, ток утечки, CAN, LIN, OBD'),
    'hv': ('Гибрид и электро', 'ВВ-безопасность, изоляция, зарядка, 48 В'),
    'grundlagen': ('Основы', 'Правила измерений, проверка проводов, неисправности'),
}
for c in D['cats']:
    c['name_ru'], c['desc_ru'] = CAT_RU[c['id']]

wb = openpyxl.load_workbook(xlsx, data_only=True)

def sheet(name, cols=None):
    ws = wb[name]
    rows = [[('' if v is None else str(v).strip()) for v in r] for r in ws.iter_rows(values_only=True)]
    head, body = rows[0], [r for r in rows[1:] if any(r)]
    if cols is not None:
        head = [head[i] for i in cols]
        body = [[r[i] for i in cols] for r in body]
    return {'head': head, 'rows': body}

X = {
    'meta': {
        'title': 'Kfz_Diagnosedatenbank V3.3', 'stand': '03.11.2026',
        'start': [[str(a or ''), str(b or '')] for a, b in wb['START'].iter_rows(values_only=True)],
        'changelog': [[str(a or ''), str(b or '')] for a, b in wb['V3.3 AENDERUNGSPROTOKOLL'].iter_rows(min_row=2, values_only=True)],
    },
    # Pin-Nr/Steckeransicht/Quellen-ID sind in allen Zeilen leer bzw. "NICHT VERIFIZIERT" -> weggelassen
    'systemtests': sheet('SYSTEMTESTS', [0, 1, 2, 3, 4, 5, 6, 7, 10, 12]),
    'obd': sheet('STANDARD-ANSCHLUESSE'),
    'zustaende': sheet('BETRIEBSZUSTAENDE'),
    'v33': sheet('V3.3 VERIFIZIERTE ERGAENZ'),
    'quellen': sheet('QUELLENPROTOKOLL'),
    'messprotokoll_head': sheet('MESSPROTOKOLL')['head'],
    'marken': sorted({r[0] for r in wb['MARKEN x SYSTEME'].iter_rows(min_row=2, values_only=True) if r[0]}),
    'systeme': sorted({r[2] for r in wb['MARKEN x SYSTEME'].iter_rows(min_row=2, values_only=True) if r[2]}),
}
# KOEO = Key On, Engine Off -> verständlich benennen
KOEO = 'Zündung ein, Motor aus (KOEO)'
def koeo(t):
    t = t.replace('Zündung an (KOEO)', KOEO)
    if t == 'KOEO': return KOEO
    return t.replace('KOEO, ', KOEO + ', ').replace(', KOEO,', ', ' + KOEO + ',')
X['zustaende']['rows'] = [[koeo(r[0])] + r[1:] for r in X['zustaende']['rows']]
ci = X['systemtests']['head'].index('Betriebszustand')
for r in X['systemtests']['rows']:
    r[ci] = koeo(r[ci])
    r[:] = [c.replace('; KOEO ', '; Zündung ein, Motor aus: ').replace('KOEO näherungsweise', 'Zündung ein, Motor aus: näherungsweise') if isinstance(c, str) else c for c in r]
X['meta']['start'] = [[a, koeo(b)] for a, b in X['meta']['start']]

# Links in V3.3 klickbar machen (wie in den Nachschlagewerk-Tabellen)
ui = X['v33']['head'].index('Quellen-URL')
for r in X['v33']['rows']:
    u = r[ui]
    if u.startswith('https://'):
        r[ui] = '<a href="%s" target="_blank" rel="noopener">Quelle</a>' % u.replace('"', '%22')
# übrige Zellen HTML-escapen
def esc(v):
    return v.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
for key in ('systemtests', 'obd', 'zustaende', 'quellen'):
    X[key]['rows'] = [[esc(c) for c in r] for r in X[key]['rows']]
for r in X['v33']['rows']:
    for i, c in enumerate(r):
        if i != ui:
            r[i] = esc(c)

# Fehlercodes (eigene DTC-Regeln, Export aus kfz-diagnose/src/obd/dtc.ts). Oszi-Teil (aus fremder PDF) wird bewusst NICHT übernommen.
if fc_html:
    import re
    h = open(fc_html, encoding='utf-8').read()
    fc = json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', h, re.S).group(1))
    ids = {it['id'] for it in D['items']}
    for t in fc['texts']:
        for c in t['chapters']:
            assert c['id'] in ids, c['id']
    X['dtc'] = {'texts': fc['texts'], 'segs': fc['segs']}

D['meta']['app'] = 'JC Diagnose'
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w', encoding='utf-8') as f:
    f.write('window.KFZ=' + json.dumps(D, ensure_ascii=False, separators=(',', ':')) + ';\n')
    f.write('window.XLS=' + json.dumps(X, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('ok', 'dtc', len(X.get('dtc',{}).get('segs',[])), len(D['items']), {k: len(v['rows']) for k, v in X.items() if isinstance(v, dict) and 'rows' in v}, len(X['marken']), len(X['systeme']))
