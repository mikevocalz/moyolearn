"""Exercise authored listeners in Rive CLI, not host-side substitute controls."""
from pathlib import Path
import json, subprocess
root = Path(__file__).resolve().parent
out = root / 'evidence'
out.mkdir(exist_ok=True)
subprocess.run(['rive', str(root/'rive'), '--verify'], check=True)
subprocess.run(['rive', 'inspect', str(root/'rive'), '--summary'], check=True, stdout=(out/'inspect.json').open('w'))
cases = [
 ('rest', [], {'selectedCount':0, 'revision':0}),
 ('half', ['click@150,310','click@370,310'], {'selectedCount':2,'revision':2}),
 ('toggle-back', ['click@150,310','click@150,310'], {'selectedCount':0,'revision':2}),
 ('all-pieces', ['click@150,310','click@370,310','click@590,310','click@800,310'], {'selectedCount':4,'revision':4}),
 ('cancel', ['down@150,310','move@950,630','up@950,630'], {'selectedCount':0,'revision':0,'down0':0}),
 ('hint', ['click@775,470'], {'hintVisible':True,'lastAction':'hint'}),
 ('hint-back', ['click@775,470','click@775,470'], {'hintVisible':False}),
 ('hover', ['move@150,310'], {'hover0':1,'selectedCount':0}),
 ('press', ['down@150,310'], {'down0':1,'selectedCount':0}),
]
for name, gestures, expected in cases:
 cmd=['rive',str(root/'rive'),f'--screenshot={out/name}.png',f'--data-dump={out/name}.json']
 cmd += ['--pointer='+v for v in gestures] + ['--advance=15']
 subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL)
 values={p['name']:p.get('value') for p in json.loads((out/(name+'.json')).read_text())['viewModel']['properties']}
 for key,value in expected.items():
  assert values[key]==value, (name,key,values[key],value)
 print('PASS',name)
subprocess.run(['rive',str(root/'rive'),'--once'],check=True)
