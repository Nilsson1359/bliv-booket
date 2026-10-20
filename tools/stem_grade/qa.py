import subprocess, json, glob, os, numpy as np
os.chdir('/Users/oskarnilsson/.claude/jobs/49b04bf4/tmp/fio')
# QA pr. klip over hele længden: middel-luma, andel udbrændt (>=250) og knust (<=18), spring mellem sekunder
res = {}
for f in sorted(glob.glob(os.environ.get('QA_DIR','final2')+'/c*.mp4')):
    n = os.path.basename(f)[:-4]
    raw = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', f, '-vf', 'fps=2,scale=160:90,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, 90, 160).astype(float)
    m = a.mean((1, 2)); hi = (a >= 250).mean((1, 2)) * 100; lo = (a <= 18).mean((1, 2)) * 100
    res[n] = dict(mean=round(m.mean(), 1), mn=round(m.min(), 1), mx=round(m.max(), 1), clip=round(hi.max(), 1), crush=round(lo.max(), 1))
    flag = []
    if hi.max() > 4: flag.append('UDBRAENDT')
    if lo.max() > 30: flag.append('KNUST')
    if m.max() - m.min() > 60: flag.append('SPRING')
    if m.mean() < 55: flag.append('MOERK')
    if m.mean() > 150: flag.append('LYS')
    print(n, res[n], ' '.join(flag))
json.dump(res, open('qa.json', 'w'))
