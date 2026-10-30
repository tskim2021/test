# 사용법: python3 build_audio.py en|ja|zh  → narration_<lang>.wav, timeline_<lang>.js
# 한국어 단어는 ko 음성, 설명은 해당 언어 음성(gTTS). 배경음악 없음.
import subprocess, json, numpy as np, wave, os, sys
from gtts import gTTS
lang=sys.argv[1]; GL={'en':'en','ja':'ja','zh':'zh-CN'}[lang]
OUT='/tmp/claude-0/tts'; os.makedirs(OUT,exist_ok=True); SR=44100

# ── 한국어 단어 클립: key -> (읽을 텍스트, 천천히?, 화면에 보이는 한글 자막)
KO={'h1':("안녕하세요.",True,"안녕하세요"),'k1':("감사합니다.",True,"감사합니다"),'k3b':("감사함니다.",True,"[감사함니다]"),
    'm1':("저는.",True,"저는"),'m2':("학생.",True,"학생"),'m3':("입니다.",True,"입니다"),'m4':("저는 학생입니다.",True,"저는 학생입니다"),
    'm7':("학쌩.",True,"[학쌩]"),'q1':("안녕하세요.",True,"안녕하세요"),'q2':("감사합니다.",True,"감사합니다")}
# 한국어 클립 밑에 붙는 번역 자막
TR={'en':{'h1':"Hello",'k1':"Thank you",'k3b':"gam-sa-ham-ni-da",'m1':"I (topic)",'m2':"student",'m3':"am / is",'m4':"I am a student.",'m7':"hak-ssaeng",'q1':"Hello",'q2':"Thank you"},
    'ja':{'h1':"こんにちは",'k1':"ありがとうございます",'k3b':"gam-sa-ham-ni-da",'m1':"私は",'m2':"学生",'m3':"〜です",'m4':"私は学生です。",'m7':"hak-ssaeng",'q1':"こんにちは",'q2':"ありがとうございます"},
    'zh':{'h1':"你好",'k1':"谢谢",'k3b':"gam-sa-ham-ni-da",'m1':"我（话题）",'m2':"学生",'m3':"是",'m4':"我是学生。",'m7':"hak-ssaeng",'q1':"你好",'q2':"谢谢"}}[lang]
# ── 해당 언어 설명 클립
LOC={
'en':{'i1':"Welcome to TOPIK Beginner, lesson one. Today: three greetings.",
 'h2':"It means hello. Use it when you meet someone. It's polite, so it works with anyone.",
 'hj':"Look at the first block. The circle is silent. Add a, add n: an.",
 'h3':"Now, repeat after me.",
 'k2':"It means thank you. Use it when someone helps you.",
 'k3':"Careful: it looks like b, but we say m. Listen.",
 'm3b':"Put them together.",'m5':"Use it to introduce yourself.",
 'q0':"Quick quiz!",'qa':"How do you say hello?",
 'o1':"Great job! See you next lesson."},
'ja':{'i1':"TOPIK初級、レッスン1。今日は三つのあいさつです。",
 'h2':"こんにちは、という意味。会ったときに使う、丁寧な言い方です。",
 'hj':"最初の文字。丸は無音。アとンで、アン。",
 'h3':"続けて言いましょう。",
 'k2':"ありがとう、という意味。助けてもらったときに使います。",
 'k3':"注意。文字はプですが、ムと発音します。聞いてください。",
 'm3b':"つなげると。",'m5':"自己紹介で使います。",
 'q0':"クイズ！",'qa':"こんにちは、は韓国語で？",
 'o1':"お疲れさま！次のレッスンで会いましょう。"},
'zh':{'i1':"欢迎来到TOPIK初级第一课。今天学三句问候语。",
 'h2':"意思是，你好。见面时使用，是敬语，对谁都可以用。",
 'hj':"看第一个字。圆圈不发音。加上a和n，读作an。",
 'h3':"跟我一起读。",
 'k2':"意思是，谢谢。别人帮助你时使用。",
 'k3':"注意，看起来是b，实际读m。听一听。",
 'm3b':"连起来。",'m5':"用来自我介绍。",
 'q0':"小测验！",'qa':"你好，韩语怎么说？",
 'o1':"做得好！下节课见。"}}[lang]
TEMPO={'en':1.1,'ja':1.3,'zh':1.25}[lang]
GAP={'hgap':2.6,'kgap':2.6,'mgap':2.6,'qg':2.6}
SCENES=[('intro',['i1']),('hello',['h1','h2','hj','h3','hgap']),('thanks',['k1','k2','k3','k3b','kgap']),
 ('me',['m1','m2','m3','m3b','m4','m5','mgap']),('quiz',['q0','qa','qg','q1']),('outro',['o1'])]

def load(path,tempo=1.0):
    raw=subprocess.run(['ffmpeg','-v','error','-i',path,'-af',f'atempo={tempo}','-ac','1','-ar',str(SR),'-f','s16le','-'],capture_output=True,check=True).stdout
    a=np.frombuffer(raw,dtype='<i2').astype(np.float32)/32768
    idx=np.where(np.abs(a)>0.01)[0]; return a[idx[0]:idx[-1]+1] if len(idx) else a
def clip(path,text,glang,slow,tempo=1.0):
    if not os.path.exists(path): gTTS(text,lang=glang,slow=slow).save(path)
    return load(path,tempo)
LEAD,PAD,TAIL=0.5,0.2,0.4
t=0; items={}; subs=[]; scenes=[]; events=[]
for sid,keys in SCENES:
    s0=t; t+=LEAD
    for k in keys:
        if k in GAP: items[k]=[t,t+GAP[k]]; t+=GAP[k]+PAD; continue
        if k in KO:
            text,slow,sk=KO[k]; a=clip(f'{OUT}/ko_{k}.mp3',text,'ko',slow); sub=dict(ko=sk,en=TR[k])
        else:
            a=clip(f'{OUT}/{lang}_{k}.mp3',LOC[k],GL,False,TEMPO); sub=dict(ko=LOC[k],en='')
        d=len(a)/SR; items[k]=[t,t+d]; subs.append(dict(t0=t,t1=t+d,**sub)); events.append((t,a)); t+=d+PAD
    t+=TAIL-PAD; scenes.append(dict(id=sid,t0=s0,t1=t))
dur=t; buf=np.zeros(int(dur*SR)+SR)
for st,a in events: i=int(st*SR); buf[i:i+len(a)]+=a
buf=buf/np.abs(buf).max()*0.9
w=wave.open(f'narration_{lang}.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((buf[:int(dur*SR)]*32767).astype('<i2').tobytes()); w.close()
FPS=30; NB=56; nf=int(dur*FPS)+2; hw=np.hanning(2048); fr=np.fft.rfftfreq(2048,1/SR)
edges=np.geomspace(90,7000,NB+1); B=np.zeros((nf,NB)); pad=np.concatenate([np.zeros(1024),buf,np.zeros(2048)])
for f in range(nf):
    i=int(f/FPS*SR); m=np.abs(np.fft.rfft(pad[i:i+2048]*hw))
    for b in range(NB):
        sel=(fr>=edges[b])&(fr<edges[b+1]); B[f,b]=m[sel].mean() if sel.any() else 0
B=np.log1p(B*6); B=np.clip(B/np.percentile(B,99.5),0,1)
for f in range(1,nf): B[f]=np.maximum(B[f],B[f-1]*0.72)
# 화면 라벨(언어별)
LAB={'en':dict(hdr="BEGINNER · LESSON 01",i3="Greetings · Say hello in Korean",polite="존댓말 · Polite",
   kh="HELLO · 인사",kt="THANK YOU · 감사",km="I AM A STUDENT · 자기소개",kq="QUICK QUIZ · 퀴즈",ko_="TODAY'S EXPRESSIONS · 오늘 배운 표현",
   mh="Hello",mt="Thank you",mm="I am a student",ctx="When someone helps you",wr="WRITTEN",sd="SOUNDS LIKE",
   turn="Your turn · 따라 해 보세요",turn2="Say it out loud with me",t1="PRONOUN + TOPIC",g1="I",t2="NOUN",g2="student",t3="VERB · TO BE",g3="am / is",
   ql="How do you say…",nl="NEXT LESSON",nx="02 · 숫자 Numbers",font='en'),
 'ja':dict(hdr="初級 · レッスン 01",i3="あいさつ · 韓国語でこんにちは",polite="존댓말 · 丁寧語",
   kh="こんにちは · 인사",kt="ありがとう · 감사",km="私は学生です · 자기소개",kq="ミニクイズ · 퀴즈",ko_="今日の表現 · 오늘 배운 표현",
   mh="こんにちは",mt="ありがとうございます",mm="私は学生です",ctx="助けてもらったとき",wr="表記",sd="発音",
   turn="あなたの番 · 따라 해 보세요",turn2="一緒に声に出して言おう",t1="代名詞 + は",g1="私は",t2="名詞",g2="学生",t3="です",g3="〜です",
   ql="韓国語でなんと言う？",nl="次のレッスン",nx="02 · 숫자 数字",font='ja'),
 'zh':dict(hdr="初级 · 第 01 课",i3="问候 · 用韩语打招呼",polite="존댓말 · 敬语",
   kh="你好 · 인사",kt="谢谢 · 감사",km="我是学生 · 자기소개",kq="小测验 · 퀴즈",ko_="今天学的表达 · 오늘 배운 표현",
   mh="你好",mt="谢谢",mm="我是学生",ctx="别人帮助你的时候",wr="书写",sd="发音",
   turn="轮到你了 · 따라 해 보세요",turn2="跟我大声读出来",t1="代词 + 主题助词",g1="我",t2="名词",g2="学生",t3="动词 · 是",g3="是",
   ql="用韩语怎么说…",nl="下节课",nx="02 · 숫자 数字",font='zh')}[lang]
LAB.update(g_hello=LAB['mh'],g_thanks=LAB['mt'])
open(f'timeline_{lang}.js','w').write('const TL='+json.dumps(dict(dur=dur,scenes=scenes,items=items,subs=subs,bands=(B*100).round().astype(int).tolist()),ensure_ascii=False)+';const L='+json.dumps(LAB,ensure_ascii=False)+';')
print(lang,'duration',round(dur,1)); [print(' ',s['id'],round(s['t0'],1),round(s['t1'],1)) for s in scenes]
