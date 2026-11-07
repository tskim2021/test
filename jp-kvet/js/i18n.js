// 日本語(既定) / 한국어 切替。確認用に韓国語UIを用意(病院名・住所は日本語の原文のまま)。
(function () {
  var D = {
    ja: {
      brandSub: 'JAPAN',
      navHome: 'ホーム', navFind: '動物病院を探す', navCost: '診療費の目安', navGuide: '犬・猫図鑑', navNotice: 'お知らせ',
      soon: '準備中',
      heroTitle: 'ペットの病院探し、かんたんに',
      heroSub: '全国の動物病院を地図と一覧からすぐに検索。電話・経路案内までワンタップで。',
      heroCount: '全国 {n} 件の動物病院を掲載',
      qaReceipt: '領収書チェック', qaCost: '地域の診療費', qaFind: '動物病院を探す', qaGuide: '犬・猫図鑑', qaId: '迷子札発行', qaDiary: 'ペット日記',
      homeSearchPh: '病院名・地域・駅名で検索(例: 渋谷区、横浜市)',
      homeSearchBtn: '病院を探す',
      popular: '人気のエリア',
      footNote: '掲載情報は Overture Maps・OpenStreetMap を基にしており、公式の全件名簿ではありません。診療時間・診療内容は事前にお電話でご確認ください。',
      finderTitle: '全国の動物病院', mapChip: '地図',
      searchPh: '病院名・地域で検索', prefAll: 'すべての都道府県',
      near: '現在地', r2: '2km', r5: '5km', r10: '10km', rAll: '全国',
      locating: '現在地を取得中…', locFail: '現在地を取得できませんでした。ブラウザの位置情報を許可してください。',
      resultsAll: '{n} 件', resultsNear: '現在地から {r} 以内 {n} 件', noResult: '該当する動物病院がありません。',
      more: 'さらに表示', noPhone: '電話番号の情報なし',
      detailTitle: '病院情報', tagVet: '動物病院', call: '電話', route: '経路', share: '共有', copyAddr: '住所コピー',
      basic: '基本情報', noPhoneFull: '電話番号の登録がありません', website: 'ウェブサイト', postcode: '〒',
      allIn: '{c} の動物病院をすべて見る', disclaimer: '掲載情報は Overture Maps・OpenStreetMap 基準です。診療時間・診療科目は来院前にお電話でご確認ください。',
      copied: 'コピーしました', linkCopied: 'リンクをコピーしました',
      mapNoKeyTitle: '地図は未設定です', mapNoKeyBody: 'js/config.js に Google Maps APIキーを設定すると地図が表示されます。一覧と検索はそのままご利用いただけます。',
      mapLoadFail: 'Google マップを読み込めませんでした。APIキーとリファラー制限を確認してください。',
      koNote: '病院名・住所は日本語の原文です。'
    },
    ko: {
      brandSub: 'JAPAN',
      navHome: '홈', navFind: '동물병원 찾기', navCost: '진료비 안내', navGuide: '견종·고양이 백과', navNotice: '공지사항',
      soon: '준비 중',
      heroTitle: '반려동물 병원 찾기, 쉽게 하세요',
      heroSub: '일본 전국 동물병원을 지도와 목록으로 바로 검색하고, 전화·길찾기까지 한 번에.',
      heroCount: '전국 동물병원 {n}곳 수록',
      qaReceipt: '영수증 확인', qaCost: '우리 동네 진료비', qaFind: '동물병원 찾기', qaGuide: '견종·고양이 백과', qaId: '개민증 발급', qaDiary: '반려동물 생활일지',
      homeSearchPh: '병원 이름·지역으로 검색 (예: 시부야구, 요코하마시)',
      homeSearchBtn: '병원 찾기',
      popular: '인기 지역',
      footNote: '수록 정보는 Overture Maps·OpenStreetMap 기반이며 공식 전수 명부가 아닙니다. 진료 시간·진료 과목은 방문 전 전화로 확인해 주세요.',
      finderTitle: '전국 동물병원', mapChip: '지도',
      searchPh: '병원 이름이나 지역으로 검색', prefAll: '모든 도도부현',
      near: '내 주변', r2: '2km', r5: '5km', r10: '10km', rAll: '전체',
      locating: '내 위치 확인 중…', locFail: '현재 위치를 가져오지 못했어요. 브라우저의 위치 권한을 허용해 주세요.',
      resultsAll: '{n}곳', resultsNear: '내 위치 {r} 안 {n}곳', noResult: '조건에 맞는 동물병원이 없어요.',
      more: '더 보기', noPhone: '전화번호 정보 없음',
      detailTitle: '병원 정보', tagVet: '동물병원', call: '전화', route: '길찾기', share: '공유', copyAddr: '주소복사',
      basic: '기본 정보', noPhoneFull: '등록된 전화번호가 없어요', website: '웹사이트', postcode: '우편번호 ',
      allIn: '{c} 동물병원 전체 보기', disclaimer: '수록 정보는 Overture Maps·OpenStreetMap 기준이에요. 실제 진료 시간과 진료 과목은 방문 전 전화로 확인해 주세요.',
      copied: '복사했어요', linkCopied: '링크를 복사했어요',
      mapNoKeyTitle: '지도가 아직 설정되지 않았어요', mapNoKeyBody: 'js/config.js에 Google Maps API 키를 넣으면 지도가 표시돼요. 목록과 검색은 그대로 사용할 수 있어요.',
      mapLoadFail: '구글 지도를 불러오지 못했어요. API 키와 리퍼러 제한을 확인해 주세요.',
      koNote: '병원명·주소는 일본어 원문이에요.'
    }
  };
  var PREF_KO = '홋카이도 아오모리현 이와테현 미야기현 아키타현 야마가타현 후쿠시마현 이바라키현 도치기현 군마현 사이타마현 지바현 도쿄도 가나가와현 니가타현 도야마현 이시카와현 후쿠이현 야마나시현 나가노현 기후현 시즈오카현 아이치현 미에현 시가현 교토부 오사카부 효고현 나라현 와카야마현 돗토리현 시마네현 오카야마현 히로시마현 야마구치현 도쿠시마현 가가와현 에히메현 고치현 후쿠오카현 사가현 나가사키현 구마모토현 오이타현 미야자키현 가고시마현 오키나와현'.split(' ');
  var lang = 'ja';
  try { lang = localStorage.getItem('jpkvet_lang') || (/^ko/i.test(navigator.language) ? 'ja' : 'ja'); } catch (e) {}
  if (!D[lang]) lang = 'ja';
  function t(k, v) {
    var s = (D[lang] && D[lang][k]) || D.ja[k] || k;
    if (v) for (var x in v) s = s.replace('{' + x + '}', v[x]);
    return s;
  }
  function apply() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (e) { e.textContent = t(e.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (e) { e.placeholder = t(e.getAttribute('data-i18n-ph')); });
    document.querySelectorAll('.lang-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.lang === lang); });
    var n = document.getElementById('koNote'); if (n) n.hidden = lang !== 'ko';
  }
  function set(l) {
    lang = l; try { localStorage.setItem('jpkvet_lang', l); } catch (e) {}
    apply(); document.dispatchEvent(new CustomEvent('langchange', { detail: l }));
  }
  window.I18N = { t: t, get lang() { return lang; }, set: set, apply: apply,
    prefName: function (idx, ja) { return lang === 'ko' ? PREF_KO[idx] : ja; }, PREF_KO: PREF_KO };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.lang-btn').forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.lang); }); });
    apply();
  });
})();
