# 사용법: python3 gen_meta.py → ../metadata/titles_<lang>.tsv, titles_<lang>.md (유튜브 제목·설명·해시태그, 언어별)
import os,opencc
from lessons import LESSONS
from i18n import TH,MS,lookup
S2T=opencc.OpenCC('s2twp')
def R(x,lang):
    if lang in('en','ja','zh'): return x[lang]
    if x['en']==x['ja']==x['zh']: return x['en']
    if lang=='tw': return S2T.convert(x['zh'])
    return lookup(x['en'],TH if lang=='th' else MS,False)
TITLE={'en':"Learn Korean · TOPIK 1 Lesson {n}: {t} | Beginner Korean",
 'ja':"韓国語を学ぼう TOPIK 1級 第{n}課：{t}｜初心者向け",
 'zh':"学韩语 TOPIK 1级 第{n}课：{t}｜零基础韩语",
 'tw':"學韓語 TOPIK 1級 第{n}課：{t}｜零基礎韓語",
 'th':"เรียนภาษาเกาหลี TOPIK 1 บทที่ {n}: {t} | สำหรับผู้เริ่มต้น",
 'ms':"Belajar Bahasa Korea TOPIK 1 Pelajaran {n}: {t} | Untuk Pemula"}
INTRO={'en':"A 1-minute Korean lesson for beginners (TOPIK Level 1). Today: {t}.",
 'ja':"1分で学ぶ韓国語レッスン（TOPIK 1級・初心者向け）。今日のテーマ：{t}。",
 'zh':"1分钟韩语小课堂（TOPIK 1级，零基础）。今天学：{t}。",
 'tw':"1分鐘韓語小教室（TOPIK 1級，零基礎）。今天學：{t}。",
 'th':"บทเรียนภาษาเกาหลี 1 นาทีสำหรับผู้เริ่มต้น (TOPIK ระดับ 1) วันนี้: {t}",
 'ms':"Pelajaran Bahasa Korea 1 minit untuk pemula (TOPIK Tahap 1). Hari ini: {t}."}
EXPR={'en':"Expressions in this lesson:",'ja':"今日の表現：",'zh':"本课表达：",'tw':"本課表達：",'th':"สำนวนในบทนี้:",'ms':"Ungkapan dalam pelajaran ini:"}
TAGS={'en':"#LearnKorean #Korean #TOPIK #KoreanForBeginners #Hangul",
 'ja':"#韓国語 #韓国語勉強 #TOPIK #ハングル #韓国語初心者",
 'zh':"#学韩语 #韩语 #TOPIK #韩语入门 #韩文",
 'tw':"#學韓語 #韓語 #TOPIK #韓語入門 #韓文",
 'th':"#เรียนภาษาเกาหลี #ภาษาเกาหลี #TOPIK #ฮันกึล #เกาหลีมือใหม่",
 'ms':"#BelajarBahasaKorea #BahasaKorea #TOPIK #Hangul #KoreaUntukPemula"}
NEXT={'en':"Next: Lesson {m}",'ja':"次回：第{m}課",'zh':"下节课：第{m}课",'tw':"下一課：第{m}課",'th':"บทต่อไป: บทที่ {m}",'ms':"Seterusnya: Pelajaran {m}"}
os.makedirs('../metadata',exist_ok=True)
for lang in TITLE:
    tsv=['lesson\tkind\ttitle\tdescription'];md=[f'# TOPIK 1 · {lang}\n']
    for n in range(1,21):
        L=LESSONS[n]; t=R(L['topic'],lang); t=t[0].upper()+t[1:] if lang in('en','ms') else t
        rec=[f"・{ko} — {R(g,lang) if isinstance(g,dict) else g} ({rom})" for ko,g,rom in L['scenes'][-1]['recap']]
        desc=INTRO[lang].format(t=t)+"\n\n"+EXPR[lang]+"\n"+"\n".join(rec)+"\n\n"+(NEXT[lang].format(m=n+1) if n<20 else "")+"\n\n"+TAGS[lang]+" #Shorts"
        for kind,suf in(('video',''),('shorts',' #Shorts')):
            ti=TITLE[lang].format(n=n,t=t)+suf
            d=desc if kind=='shorts' else desc.replace(" #Shorts","")
            tsv.append(f"{n}\t{kind}\t{ti}\t{d.replace(chr(10),' / ')}")
        md.append(f"## {n:02d}\n**{TITLE[lang].format(n=n,t=t)}**\n\n{desc.replace(' #Shorts','')}\n")
    open(f'../metadata/titles_{lang}.tsv','w').write('\n'.join(tsv)+'\n'); open(f'../metadata/titles_{lang}.md','w').write('\n'.join(md))
print('ok')
