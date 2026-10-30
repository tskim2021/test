# 내레이션 생성 + 타임라인(timeline.js) 작성. 배경음악 없음.
import subprocess, json, numpy as np, wave, os
from gtts import gTTS
OUT='/tmp/claude-0/tts'; os.makedirs(OUT,exist_ok=True); SR=44100
# (key, text, slow, 한국어 자막, 영어 자막)  /  ('gap', key, 초)
SCENES=[
 ('intro',[('i1',"토픽 초급 일 강. 오늘은 인사하기예요.",False,"TOPIK 초급 1강, 오늘은 인사하기예요.","TOPIK Beginner Lesson 1 — today: greetings")]),
 ('hello',[('h1',"안녕하세요.",True,"안녕하세요","Hello"),
           ('h2',"만날 때 하는 인사예요.",False,"만날 때 하는 인사예요.","We say this when we meet someone."),
           ('h3',"따라 해 보세요.",False,"따라 해 보세요.","Now you repeat."),
           ('gap','hgap',2.2)]),
 ('thanks',[('k1',"감사합니다.",True,"감사합니다","Thank you"),
            ('k2',"고마울 때 써요.",False,"고마울 때 써요.","We use it to say thanks."),
            ('k3',"합니다는, 함니다, 라고 읽어요.",False,"‘합니다’는 [함니다]라고 읽어요.","‘합니다’ is pronounced ‘hamnida’."),
            ('gap','kgap',2.0)]),
 ('me',[('m1',"저는.",True,"저는 — 나는","jeo-neun = I (topic)"),
        ('m2',"학생.",True,"학생 — student","hak-ssaeng = student"),
        ('m3',"입니다.",True,"입니다 — ~입니다","im-ni-da = am / is"),
        ('m4',"저는 학생입니다.",True,"저는 학생입니다","I am a student."),
        ('m5',"나를 소개할 때 써요.",False,"나를 소개할 때 써요.","Use it to introduce yourself."),
        ('gap','mgap',2.0)]),
 ('outro',[('o1',"수고하셨어요! 다음 시간에 만나요.",False,"수고하셨어요! 다음 시간에 만나요.","Great job! See you next lesson.")]),
]
def load(path):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-ac','1','-ar',str(SR),'-f','s16le','-'],capture_output=True,check=True).stdout
    a=np.frombuffer(raw,dtype='<i2').astype(np.float32)/32768
    idx=np.where(np.abs(a)>0.01)[0]; return a[idx[0]:idx[-1]+1] if len(idx) else a
def clip(key,text,slow):
    p=f'{OUT}/{key}.mp3'
    if not os.path.exists(p): gTTS(text,lang='ko',slow=slow).save(p)
    return load(p)
LEAD,PAD,TAIL=0.7,0.3,0.6
t=0; items={}; subs=[]; scenes=[]; events=[]
for sid,its in SCENES:
    s0=t; t+=LEAD
    for it in its:
        if it[0]=='gap': items[it[1]]=[t,t+it[2]]; t+=it[2]+PAD; continue
        k,text,slow,ko,en=it; a=clip(k,text,slow); d=len(a)/SR
        items[k]=[t,t+d]; subs.append(dict(t0=t,t1=t+d,ko=ko,en=en)); events.append((t,a)); t+=d+PAD
    t+=TAIL-PAD; scenes.append(dict(id=sid,t0=s0,t1=t))
dur=t; buf=np.zeros(int(dur*SR)+SR)
for st,a in events: i=int(st*SR); buf[i:i+len(a)]+=a
buf=buf/np.abs(buf).max()*0.9
w=wave.open('narration.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((buf[:int(dur*SR)]*32767).astype('<i2').tobytes()); w.close()
# 오디오 스펙트럼(프레임당 56밴드) -> 파형 시각화용
FPS=30; NB=56; nf=int(dur*FPS)+2; w_=np.hanning(2048); fr=np.fft.rfftfreq(2048,1/SR)
edges=np.geomspace(90,7000,NB+1); B=np.zeros((nf,NB)); pad=np.concatenate([np.zeros(1024),buf,np.zeros(2048)])
for f in range(nf):
    i=int(f/FPS*SR); m=np.abs(np.fft.rfft(pad[i:i+2048]*w_))
    for b in range(NB):
        sel=(fr>=edges[b])&(fr<edges[b+1]); B[f,b]=m[sel].mean() if sel.any() else 0
B=np.log1p(B*6); B=B/np.percentile(B,99.5); B=np.clip(B,0,1)
for f in range(1,nf): B[f]=np.maximum(B[f],B[f-1]*0.72)
bands=(B*100).round().astype(int).tolist()
open('timeline.js','w').write('const TL='+json.dumps(dict(dur=dur,scenes=scenes,items=items,subs=subs,bands=bands),ensure_ascii=False)+';')
print('duration',round(dur,1)); [print(k,[round(x,1) for x in v]) for k,v in items.items()]
