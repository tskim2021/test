# K-VET JAPAN (jp.k-vet.co.kr)

일본 전국 동물병원 검색 사이트(일본어 UI + 한국어 확인용 전환). 기존 `k-vet.co.kr`과 **완전히 별도 폴더**의 정적 사이트입니다(빌드 불필요).

```
jp-kvet/
  index.html            홈(검색창·인기 지역)
  map.html              동물병원 찾기(Google 지도 + 목록 + 상세)
  css/style.css  js/{config,i18n,finder}.js
  data/vets.json        웹용 데이터(7,564건, 약 1MB) ← build_data.py가 생성
  data/jp_vets_final.csv  원본(Overture Maps + OSM 병합본)
  scripts/build_data.py CSV → vets.json (pip install phonenumbers)
```

## 로컬 실행
```bash
cd jp-kvet && python3 -m http.server 8765   # http://localhost:8765
```

## Google 지도 설정 (필수)
1. Google Cloud Console에서 **Maps JavaScript API**를 켜고 API 키를 발급합니다.
2. 키에 **HTTP 리퍼러 제한** `https://jp.k-vet.co.kr/*` (개발 시 `http://localhost:8765/*`)을 반드시 겁니다.
3. `js/config.js`의 `GOOGLE_MAPS_API_KEY`에 입력합니다. 키가 비어 있으면 지도만 숨겨지고 목록·검색은 동작합니다.

## 배포 / DNS
정적 파일이라 Cloudflare Pages·Netlify·Vercel·nginx 어디든 `jp-kvet/` 폴더를 그대로 올리면 됩니다.
DNS는 `jp` 호스트(CNAME 또는 A)를 호스팅 서비스에 연결하고 HTTPS를 켜세요.

## 데이터 / 한계
- 출처: Overture Maps Places(2026-10-21.0) + OpenStreetMap(Japan). 공식 전수 명부가 아니며 휴업·이전 병원이 섞일 수 있습니다.
- OSM 데이터는 ODbL이므로 출처 표기(푸터 문구)를 유지하세요.
- 한국어 전환은 UI 문구와 도도부현명만 번역합니다(병원명·주소는 일본어 원문).
- 영업 중 표시·24시간 응급 필터는 데이터가 없어 넣지 않았습니다.
