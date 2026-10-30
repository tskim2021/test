import numpy as np, wave
sr=44100; T=30; n=sr*T; t=np.arange(n)/sr
hz=lambda m:440*2**((m-69)/12)
chords=[[48,55,64,67],[45,52,60,64],[41,48,57,60],[43,50,59,62]]  # C Am F G(add)
L=np.zeros(n);R=np.zeros(n);seg=T/4
for ci,ch in enumerate(chords):
    s,e=int(ci*seg*sr),int((ci+1)*seg*sr);tt=t[s:e]-t[s]
    env=np.minimum(1,tt/1.5)*np.minimum(1,(seg-tt)/1.5+0.3).clip(0,1)
    for k,m in enumerate(ch):
        for det in(-0.15,0.15):
            w=np.sin(2*np.pi*hz(m)*(1+det/100)*tt)+.3*np.sin(2*np.pi*hz(m)*2*tt)
            pan=.3+.4*k/3;L[s:e]+=w*env*(1-pan)*.05;R[s:e]+=w*env*pan*.05
    arp=[ch[1]+12,ch[2]+12,ch[3]+12,ch[2]+12]*2
    for j,m in enumerate(arp):
        st=s+int(j*seg/8*sr);ln=int(1.6*sr);ln=min(ln,n-st);x=np.arange(ln)/sr
        note=np.sin(2*np.pi*hz(m)*x)*np.exp(-x*2.2)*np.minimum(1,x*80)*.09
        pan=.35+.3*(j%4)/3;L[st:st+ln]+=note*(1-pan);R[st:st+ln]+=note*pan
def echo(x,d,g):
    y=x.copy();y[d:]+=g*x[:-d];return y
for dl in(.31,.47):L=echo(L,int(dl*sr),.35);R=echo(R,int(dl*sr*1.07),.35)
fade=np.minimum(1,t/2)*np.minimum(1,(T-t)/3)
st=np.stack([L*fade,R*fade],1);st=st/np.abs(st).max()*.55
w=wave.open('music.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr)
w.writeframes((st*32767).astype('<i2').tobytes());w.close()
