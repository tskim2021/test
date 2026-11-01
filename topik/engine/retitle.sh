#!/bin/bash
# 사용법: [LANGS=".."] [LESSONS=".."] ./retitle.sh  → 이미 만든 가로 영상의 인트로(첫 장면)만 새로 그려 끼워 넣는다 (나머지 화면·음성은 그대로)
cd "$(dirname "$0")"
SLUG=(x hangul greetings numbers1 numbers2 this-that country-job places time ordering review1 days dates family food daily past shopping transport sorry-please review2)
LANGS=${LANGS:-en ja zh th ms tw}; LESSONS=${LESSONS:-$(seq 1 20)}
one() { local NN=$1 l=$2 n=$((10#$1)); local v=../videos/TOPIK1_L${NN}_${SLUG[$n]}_$l.mp4; local d=/tmp/claude-0/frames_${NN}_$l; local mk=../out/retitled_${NN}_$l; [ -f $mk ] && return
  local t1=$(python3 -c "import re,json;s=open('../out/timeline_${NN}_$l.js').read();print(json.loads(re.search(r'const TL=(.*?);const L=',s,re.S).group(1))['scenes'][0]['t1'])")
  local N0=$(python3 -c "import math;print(math.ceil(30*$t1))")
  node render.cjs $NN $l $t1 >/dev/null && ffmpeg -y -loglevel error -framerate 30 -i $d/f%04d.jpg -i $v -filter_complex \
   "[1:v]trim=start_frame=$N0,setpts=PTS-STARTPTS[r];[0:v]setpts=PTS-STARTPTS[a];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]" -map "[v]" -map 1:a -c:v libx264 -crf 18 -c:a copy -movflags +faststart ${v%.mp4}.tmp.mp4 \
   && mv ${v%.mp4}.tmp.mp4 $v && touch $mk && rm -rf $d; echo "retitled L$NN $l $(date +%T)"; }
export -f one; export SLUG_STR="${SLUG[*]}"
for l in $LANGS; do for n in $LESSONS; do printf '%02d %s\n' $n $l; done; done | xargs -P3 -L1 bash -c 'SLUG=($SLUG_STR); one $0 $1'
echo "RETITLE DONE $(date +%T)"
