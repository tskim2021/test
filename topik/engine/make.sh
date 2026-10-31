#!/bin/bash
# 사용법: [LANGS="th ms tw"] ./make.sh 3 4 5   → ../videos/TOPIK1_L<NN>_<slug>_<lang>.mp4  (lang: en ja zh th ms tw)
cd "$(dirname "$0")"
SLUG=(x hangul greetings numbers1 numbers2 this-that country-job places time ordering review1 days dates family food daily past shopping transport sorry-please review2)
LANGS=${LANGS:-en ja zh th ms tw}
render() { # NN lang slug
  local NN=$1 l=$2 n=$((10#$1)); local dur
  dur=$(python3 -c "import re,json;s=open('../out/timeline_${NN}_$l.js').read();print(json.loads(re.search(r'const TL=(.*?);const L=',s,re.S).group(1))['dur'])")
  node render.cjs $NN $l $dur && ffmpeg -y -loglevel error -framerate 30 -i /tmp/claude-0/frames_${NN}_$l/f%04d.jpg -i ../out/narration_${NN}_$l.wav \
    -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -b:a 192k -shortest ../videos/TOPIK1_L${NN}_${SLUG[$n]}_$l.mp4 && rm -rf /tmp/claude-0/frames_${NN}_$l
}
for n in "$@"; do NN=$(printf %02d $n)
  for l in $LANGS; do python3 build.py $n $l || exit 1; done
  i=0; for l in $LANGS; do render $NN $l & i=$((i+1)); if [ $((i%3)) -eq 0 ]; then wait; fi; done; wait
  echo "done L$NN $(date +%T)"
done
