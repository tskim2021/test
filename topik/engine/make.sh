#!/bin/bash
# 사용법: ./make.sh 1 2 3   (강 번호들)  → ../videos/TOPIK1_L<NN>_<slug>_<en|ja|zh>.mp4
cd "$(dirname "$0")"
SLUG=(x hangul greetings numbers1 numbers2 this-that country-job places time ordering review)
for n in "$@"; do NN=$(printf %02d $n)
  for l in en ja zh; do python3 build.py $n $l || exit 1; done
  for l in en ja zh; do (
    dur=$(python3 -c "import re,json;s=open('../out/timeline_${NN}_$l.js').read();print(json.loads(re.search(r'const TL=(.*?);const L=',s,re.S).group(1))['dur'])")
    node render.cjs $NN $l $dur && ffmpeg -y -loglevel error -framerate 30 -i /tmp/claude-0/frames_${NN}_$l/f%04d.jpg -i ../out/narration_${NN}_$l.wav \
      -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest ../videos/TOPIK1_L${NN}_${SLUG[$n]}_$l.mp4 && rm -rf /tmp/claude-0/frames_${NN}_$l ) & done
  wait; echo "done L$NN $(date +%T)"
done
