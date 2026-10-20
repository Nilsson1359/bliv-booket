import json, subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
# Runde 2: LUT pr. klip fra params.json -> 720p fra 4K S-Log3-original; lyd fra den eksisterende web-fil
os.chdir('/Users/oskarnilsson/.claude/jobs/49b04bf4/tmp/fio')
f = json.load(open('files.json')); P = json.load(open('params.json'))
S = os.path.expanduser('~/bliv-booket/media/ev/stem')  # hovedcheckout = de gamle web-filer (lydkilde)
OUT = sys.argv[1] if len(sys.argv) > 1 else 'final2'; os.makedirs(OUT, exist_ok=True); os.makedirs('lut', exist_ok=True)
only = sys.argv[2].split(',') if len(sys.argv) > 2 else sorted(P)
def job(n):
    lo = n.lower(); out = f'{OUT}/{lo}.mp4'; q = P[n]
    if os.path.exists(out): return
    subprocess.run(['python3', 'mklut.py', json.dumps(q), f'lut/{n}.cube'], check=True)
    u = f[n + '.MP4']['media']['original']['inlineUrl']
    dn = ',hqdn3d=1.5:1.2:3:3' if q.get('dn') else ''
    vf = (f'setparams=range=pc,scale=1280:720:in_range=pc:out_range=pc:flags=lanczos,format=rgb48le,'
          f'lut3d=lut/{n}.cube:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p{dn}')
    rate = ['-maxrate', '1500k', '-bufsize', '3000k'] if q.get('dn') else ['-maxrate', '1800k', '-bufsize', '3600k']
    r = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', u, '-i', f'{S}/{lo}.mp4', '-map', '0:v:0', '-map', '1:a:0', '-vf', vf,
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', *rate, '-profile:v', 'high', '-r', '25',
                        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
                        '-c:a', 'copy', '-shortest', '-movflags', '+faststart', out + '.tmp.mp4'], capture_output=True, text=True)
    if r.returncode == 0: os.rename(out + '.tmp.mp4', out); print('ok', n, os.path.getsize(out), flush=True)
    else: print('FAIL', n, r.stderr[-400:], flush=True)
list(ThreadPoolExecutor(4).map(job, only))
