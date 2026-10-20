import numpy as np, sys, json
# S-Log3/S-Gamut3.Cine -> Rec.709 med filmisk skulder. Params: ev (stops), warm (+ = varmere), tint (+ = magenta), sat, pre (kurve-skalering; lavere = blødere kontrast), lift
p=json.loads(sys.argv[1]); out=sys.argv[2]
ev=p.get('ev',0); warm=p.get('warm',0.015); tint=p.get('tint',0); sat=p.get('sat',1.0); pre=p.get('pre',0.85); lift=p.get('lift',0.0)
def slog3(x):
    c=x*1023
    return np.where(c>=171.2102946929,(10**((c-420)/261.5))*0.19-0.01,(c-95)*0.01125/(171.2102946929-95))
def xy2XYZ(x,y): return np.array([x/y,1,(1-x-y)/y])
def rgb2xyz(pr,w):
    M=np.stack([xy2XYZ(*q) for q in pr],1); S=np.linalg.solve(M,xy2XYZ(*w)); return M*S
W=(0.3127,0.3290)
M=np.linalg.inv(rgb2xyz([(0.64,0.33),(0.30,0.60),(0.15,0.06)],W))@rgb2xyz([(0.766,0.275),(0.225,0.800),(0.089,-0.087)],W)
N=65; g=np.linspace(0,1,N)
b,gg,r=np.meshgrid(g,g,g,indexing='ij')
rgb=np.stack([r,gg,b],-1).reshape(-1,3)
lin=np.einsum('ij,nj->ni',M,slog3(rgb))
lin=np.maximum(lin,0)*(2**ev)
lin=lin*np.array([1+warm-tint*0.5,1-tint,1-warm-tint*0.5])
Y=np.einsum('nj,j->n',lin,np.array([0.2126,0.7152,0.0722]))[:,None]
# mætning: lidt mindre i de lyse og mørkeste toner, så hud og lys ikke bliver neon
lin=np.maximum(Y+(lin-Y)*sat,0)
a,b2,c,d,e=2.51,0.03,2.43,0.59,0.14
x=lin*pre
t=np.clip((x*(a*x+b2))/(x*(c*x+d)+e),0,1)
t=lift+(1-lift)*t
o=np.where(t<0.018,4.5*t,1.099*np.power(t,0.45)-0.099)
with open(out,'w') as f:
    f.write(f'LUT_3D_SIZE {N}\n'); f.write('\n'.join(f'{v[0]:.5f} {v[1]:.5f} {v[2]:.5f}' for v in o)+'\n')
