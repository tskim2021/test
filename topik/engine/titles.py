# 인트로 화면의 제목을 언어별로 만든다 (큰 제목=해당 언어, 한글 제목은 아래에 작게)
import opencc
from i18n import TH,MS,lookup
S2T=opencc.OpenCC('s2twp')
HDR={'en':"LEVEL 1 · LESSON {NN}",'ja':"1級 · レッスン {NN}",'zh':"1级 · 第 {NN} 课",'tw':"1級 · 第 {NN} 課",'th':"ระดับ 1 · บทที่ {NN}",'ms':"TAHAP 1 · PELAJARAN {NN}"}
def R(x,lang):
    if not isinstance(x,dict): return x
    if lang in x: return x[lang]
    if x['en']==x['ja']==x['zh']: return x['en']
    if lang=='tw': return S2T.convert(x['zh'])
    return lookup(x['en'],TH if lang=='th' else MS,lang=='ms')
def intro(LES,lang,NN):
    loc=R(LES['sub'],lang).rsplit(' · ',1)[0]
    return dict(title1=loc,title2=LES['title'],sub=HDR[lang].format(NN=NN))
