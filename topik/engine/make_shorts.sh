#!/bin/bash
# 사용법: [LANGS="en ja"] [LESSONS="1 2 3"] ./make_shorts.sh  → ../shorts/TOPIK1_L<NN>_<slug>_<lang>_shorts.mp4 (1080x1920, 60초 이내)
# 음성·타임라인은 가로 영상과 같은 것을 재사용합니다(out/). 59초를 넘으면 빈 구간(GAPS)을 줄여 다시 만듭니다.
cd "$(dirname "$0")"; mkdir -p ../shorts
SLUG=(x hangul greetings numbers1 numbers2 this-that country-job places time ordering review1 days dates family food daily past shopping transport sorry-please review2)
LANGS=${LANGS:-en ja zh th ms tw}; LESSONS=${LESSONS:-$(seq 1 20)}
dur() { python3 -c "import re,json;s=open('../out/timeline_$1_$2.js').read();print(json.loads(re.search(r'const TL=(.*?);const L=',s,re.S).group(1))['dur'])"; }
one() { local NN=$1 l=$2 n=$((10#$1)); local out=../shorts/TOPIK1_L${NN}_${SLUG[$n]}_${l}_shorts.mp4
  [ -s $out ] && return
  [ -f ../out/timeline_${NN}_$l.js ] || python3 build.py $n $l
  for g in 1.8 1.4 1.0; do
    awk -v d=$(dur $NN $l) 'BEGIN{exit !(d>59)}' || break
    GAPS=$g python3 build.py $n $l
  done
  V=1 node render.cjs $NN $l $(dur $NN $l) && ffmpeg -y -loglevel error -framerate 30 -i /tmp/claude-0/framesv_${NN}_$l/f%04d.jpg -i ../out/narration_${NN}_$l.wav \
    -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -b:a 192k -movflags +faststart -shortest $out && rm -rf /tmp/claude-0/framesv_${NN}_$l
  echo "done L$NN $l $(date +%T)"; }
export -f one dur; export SLUG_STR="${SLUG[*]}"
for l in $LANGS; do for n in $LESSONS; do printf '%02d %s\n' $n $l; done; done | xargs -P3 -L1 bash -c 'SLUG=($SLUG_STR); one $0 $1'
echo "ALL DONE $(date +%T)"
