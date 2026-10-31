# 사용법: python3 build.py <강번호> <en|ja|zh>
# 한국어 단어=한국어 음성, 설명=해당 언어 음성(gTTS). 결과: ../out/narration_NN_lang.wav, ../out/timeline_NN_lang.js (배경음악 없음)
import sys,os,json,hashlib,subprocess,wave,re
import numpy as np
from gtts import gTTS
from lessons import LESSONS,G
n=int(sys.argv[1]); lang=sys.argv[2]; NN=f"{n:02d}"
GL={'en':'en','ja':'ja','zh':'zh-CN','th':'th','ms':'ms','tw':'zh-TW'}[lang]; TEMPO={'en':1.1,'ja':1.3,'zh':1.25,'th':1.15,'ms':1.15,'tw':1.25}[lang]
HERE=os.path.dirname(os.path.abspath(__file__)); OUTD=os.path.join(HERE,'..','out'); TTS=os.path.join(OUTD,'tts')
os.makedirs(TTS,exist_ok=True); SR=44100
from i18n import TH,MS,lookup
import opencc
S2T=opencc.OpenCC('s2twp')   # 대만어(번체·대만 어휘): 중국어 간체를 변환
def R(x):
    if not isinstance(x,dict): return x
    if lang in x: return x[lang]
    if x['en']==x['ja']==x['zh']: return x['en']       # 언어 공통(로마자·숫자 등)
    if lang=='tw': return S2T.convert(x['zh'])
    if lang=='th': return lookup(x['en'],TH,False)
    if lang=='ms': return lookup(x['en'],MS,True)
strip=lambda h:re.sub(r'<[^>]+>','',h)
LES=LESSONS[n]; GAPS=2.0 if n in (10,20) else 2.5
LEAD,PAD,TAIL=0.5,0.2,0.4

def load(path,tempo):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-af',f'atempo={tempo}','-ac','1','-ar',str(SR),'-f','s16le','-'],capture_output=True,check=True).stdout
    a=np.frombuffer(raw,dtype='<i2').astype(np.float32)/32768
    idx=np.where(np.abs(a)>0.01)[0]; return a[idx[0]:idx[-1]+1] if len(idx) else a
def tts(text,glang,slow,tempo):
    p=os.path.join(TTS,hashlib.md5(f'{glang}|{slow}|{text}'.encode()).hexdigest()+'.mp3')
    if not os.path.exists(p):
        for tr in range(3):
            try: gTTS(text,lang=glang,slow=slow).save(p); break
            except Exception as e:
                if tr==2: raise
                import time; time.sleep(2+tr*3)
    return load(p,tempo)

# ── 언어별 공통 문구
INTRO={'en':lambda n,t:f"Lesson {n}. Today: {t}.",'ja':lambda n,t:f"レッスン{n}。今日は、{t}です。",'zh':lambda n,t:f"第{n}课。今天学，{t}。",'th':lambda n,t:f"บทเรียนที่ {n} วันนี้: {t}",'ms':lambda n,t:f"Pelajaran {n}. Hari ini: {t}.",'tw':lambda n,t:f"第{n}課。今天學，{t}。"}[lang]
ASK={'en':lambda p:f"How do you say {p}?",'ja':lambda p:f"{p}、は韓国語で？",'zh':lambda p:f"{p}，韩语怎么说？",'th':lambda p:f"{p} ภาษาเกาหลีพูดว่าอย่างไร",'ms':lambda p:f"Bagaimana hendak sebut {p} dalam bahasa Korea?",'tw':lambda p:f"{p}，韓語怎麼說？"}[lang]
LAB={'en':dict(hdr=f"LEVEL 1 · LESSON {NN}",turn="Your turn · 따라 해 보세요",turn2="Say it out loud with me",wr="WRITTEN",sd="SOUNDS LIKE",ql="How do you say…",nl="NEXT LESSON",kq="QUICK QUIZ · 퀴즈",ko_="TODAY'S EXPRESSIONS · 오늘 배운 표현",font='en'),
 'ja':dict(hdr=f"1級 · レッスン {NN}",turn="あなたの番 · 따라 해 보세요",turn2="一緒に声に出して言おう",wr="表記",sd="発音",ql="韓国語でなんと言う？",nl="次のレッスン",kq="ミニクイズ · 퀴즈",ko_="今日の表現 · 오늘 배운 표현",font='ja'),
 'th':dict(hdr=f"ระดับ 1 · บทที่ {NN}",turn="ตาคุณแล้ว · 따라 해 보세요",turn2="พูดออกเสียงตามฉัน",wr="การเขียน",sd="การออกเสียง",ql="พูดว่าอย่างไรในภาษาเกาหลี…",nl="บทต่อไป",kq="ควิซ · 퀴즈",ko_="สำนวนที่เรียนวันนี้ · 오늘 배운 표현",font='th'),
 'ms':dict(hdr=f"TAHAP 1 · PELAJARAN {NN}",turn="Giliran anda · 따라 해 보세요",turn2="Sebut dengan kuat bersama saya",wr="TULISAN",sd="BUNYI",ql="Bagaimana hendak sebut…",nl="PELAJARAN SETERUSNYA",kq="KUIZ · 퀴즈",ko_="UNGKAPAN HARI INI · 오늘 배운 표현",font='ms'),
 'tw':dict(hdr=f"1級 · 第 {NN} 課",turn="輪到你了 · 따라 해 보세요",turn2="跟我大聲唸出來",wr="書寫",sd="發音",ql="用韓語怎麼說…",nl="下一課",kq="小測驗 · 퀴즈",ko_="今天學的表達 · 오늘 배운 표현",font='tw'),
 'zh':dict(hdr=f"1级 · 第 {NN} 课",turn="轮到你了 · 따라 해 보세요",turn2="跟我大声读出来",wr="书写",sd="发音",ql="用韩语怎么说…",nl="下节课",kq="小测验 · 퀴즈",ko_="今天学的表达 · 오늘 배운 표현",font='zh')}[lang]

scenes=[]; items={}; subs=[]; events=[]; t=0.0
def clip(key,text,kind,sub_ko,sub_en=''):
    global t
    a=tts(text,'ko' if kind=='ko' else GL,kind=='ko',1.0 if kind=='ko' else TEMPO); d=len(a)/SR
    items[key]=[t,t+d]; subs.append(dict(t0=t,t1=t+d,ko=sub_ko,en=sub_en)); events.append((t,a)); t+=d+PAD
def gap(key,sec):
    global t
    items[key]=[t,t+sec]; t+=sec+PAD
def close(i,typ,d):
    global t
    t+=TAIL-PAD; scenes[-1].update(t1=t)
def open_scene(typ,d):
    global t
    t+=LEAD; scenes.append(dict(type=typ,t0=t-LEAD,d=d))

# 인트로
i=0; open_scene('intro',dict(num=NN,title1=f"1급 {n}강",title2=LES['title'],sub=R(LES['sub']),decor=list(LES['decor'])[:5]))
clip(f'{i}_i',INTRO(n,R(LES['topic'])),'loc',INTRO(n,R(LES['topic']))); close(i,'intro',None)
cnt=0
for sc in LES['scenes']:
    i=len(scenes); typ=sc['type']
    if typ=='outro': break
    cnt+=1; num=f"{cnt:02d}"
    if typ=='expr':
        nt=sc['note']; d=dict(num=num,kicker=R(sc['kicker']),syl=[list(x) if x else None for x in sc['syl']],meaning=R(sc['meaning']),ctx=R(sc['ctx']),
            note=dict(w=nt['w'],s=nt['s'],rule=R(nt['rule'])) if nt else None)
        open_scene('expr',d)
        clip(f'{i}_a',sc['say'],'ko',sc['disp'],R(sc['meaning'])); clip(f'{i}_b',R(sc['explain']),'loc',R(sc['explain']))
        if nt: clip(f'{i}_c',R(nt.get('c',G['listen'])),'loc',R(nt.get('c',G['listen']))); clip(f'{i}_d',nt['say'],'ko','['+strip(nt['s'])+']')
        if sc['repeat']: clip(f'{i}_r',R(G['repeat']),'loc',R(G['repeat']))
        gap(f'{i}_g',GAPS)
    elif typ=='build':
        d=dict(num=num,kicker=R(sc['kicker']),ops=sc['ops'],cards=[dict(ko=c['ko'],rom=c['rom'],tag=R(c['tag']),gloss=R(c['gloss'])) for c in sc['cards']],
            full=dict(ko=sc['full']['ko'],rom=sc['full']['rom'],loc=R(sc['full']['loc'])))
        open_scene('build',d)
        for k,c in enumerate(sc['cards'],1): clip(f'{i}_c{k}',c['say'],'ko',c['ko'],R(c['gloss']))
        clip(f'{i}_a',R(G['together']),'loc',R(G['together'])); clip(f'{i}_f',sc['full']['say'],'ko',sc['full']['ko'],R(sc['full']['loc']))
        clip(f'{i}_u',R(sc['use']),'loc',R(sc['use'])); gap(f'{i}_g',GAPS)
    elif typ=='quiz':
        rev=isinstance(sc['rom'],dict)
        d=dict(num=num,prompt=R(sc['prompt']),ans=sc['ko'],rom=R(sc['rom']),ql=R(sc['qlabel']) if sc.get('qlabel') else LAB['ql'])
        open_scene('quiz',d); ask=R(sc['ask']) if sc.get('ask') else ASK(R(sc['prompt']))
        clip(f'{i}_q',ask,'loc',ask); gap(f'{i}_g',GAPS); clip(f'{i}_a',sc['say'],'ko',sc['say'].rstrip('.'),R(sc['rom']) if rev else R(sc['prompt']))
    close(i,typ,d)
# 아웃트로
sc=LES['scenes'][-1]; i=len(scenes)
nxt=LES.get('next') or (LESSONS[n+1]['title'],None)
if 'next' in LES: nt_=f"{LES['next'][0]} · {R(LES['next'][1])}";
else: nt_=f"{n+1:02d} · {LESSONS[n+1]['title']}"
d=dict(recap=[dict(ko=a,gloss=R(b),rom=c) for a,b,c in sc['recap']],next=dict(nl=LAB['nl'],text=nt_))
open_scene('outro',d); bye=R(LES['bye']) if 'bye' in LES else R(G['bye']); clip(f'{i}_o',bye,'loc',bye); close(i,'outro',d)

dur=t; buf=np.zeros(int(dur*SR)+SR)
for st,a in events: j=int(st*SR); buf[j:j+len(a)]+=a
buf=buf/np.abs(buf).max()*0.9
with wave.open(os.path.join(OUTD,f'narration_{NN}_{lang}.wav'),'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf[:int(dur*SR)]*32767).astype('<i2').tobytes())
FPS=30; NB=56; nf=int(dur*FPS)+2; hw=np.hanning(2048); fr=np.fft.rfftfreq(2048,1/SR)
edges=np.geomspace(90,7000,NB+1); B=np.zeros((nf,NB)); pad=np.concatenate([np.zeros(1024),buf,np.zeros(2048)])
for f in range(nf):
    j=int(f/FPS*SR); m=np.abs(np.fft.rfft(pad[j:j+2048]*hw))
    for b in range(NB):
        sel=(fr>=edges[b])&(fr<edges[b+1]); B[f,b]=m[sel].mean() if sel.any() else 0
B=np.log1p(B*6); B=np.clip(B/np.percentile(B,99.5),0,1)
for f in range(1,nf): B[f]=np.maximum(B[f],B[f-1]*0.72)
open(os.path.join(OUTD,f'timeline_{NN}_{lang}.js'),'w').write('const TL='+json.dumps(dict(dur=dur,scenes=scenes,items=items,subs=subs,bands=(B*100).round().astype(int).tolist()),ensure_ascii=False)+';const L='+json.dumps(LAB,ensure_ascii=False)+';')
print(f'L{NN} {lang} {dur:.1f}s')
