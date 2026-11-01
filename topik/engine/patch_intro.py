# 이미 만든 타임라인(out/timeline_NN_lang.js)의 인트로 제목만 새 방식으로 교체 (음성·길이는 그대로)
import re,json,glob
from lessons import LESSONS
from titles import intro
for p in sorted(glob.glob('../out/timeline_*_*.js')):
    NN,lang=re.search(r'timeline_(\d\d)_(\w+)\.js',p).groups()
    s=open(p).read(); mm=re.search(r'const TL=(.*?);const L=',s,re.S); TL=json.loads(mm.group(1))
    TL['scenes'][0]['d'].update(intro(LESSONS[int(NN)],lang,NN))
    open(p,'w').write(s[:mm.start(1)]+json.dumps(TL,ensure_ascii=False)+s[mm.end(1):])
print('patched')
