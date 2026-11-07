(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var t = function (k, v) { return I18N.t(k, v); };
  var PAGE = 60, state = { q: '', pref: -1, r: 0, loc: null, shown: PAGE, sel: null, filtered: [] };
  var items = [], PREFS = [], map = null, clusterer = null, markers = {}, mapReady = false, selMarker = null;

  function toast(msg) { var e = $('toast'); e.textContent = msg; e.classList.add('on'); setTimeout(function () { e.classList.remove('on'); }, 1800); }
  function dist(a, b, c, d) { var R = 6371, p = Math.PI / 180, x = (c - a) * p, y = (d - b) * p;
    var h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * p) * Math.cos(c * p) * Math.sin(y / 2) * Math.sin(y / 2);
    return 2 * R * Math.asin(Math.sqrt(h)); }
  function fmtKm(k) { return k < 1 ? Math.round(k * 1000) + 'm' : k.toFixed(1) + 'km'; }
  function norm(s) { return (s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ''); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fullAddr(v) { return [v.postcode ? '〒' + v.postcode : '', PREFS[v.pref], v.city, v.address].filter(Boolean).join(' '); }

  function matches(v, qs) {
    if (state.pref >= 0 && v.pref !== state.pref) return false;
    if (!qs.length) return true;
    return qs.every(function (w) { return v._s.indexOf(w) >= 0; });
  }
  function queryTerms() {
    var q = state.q.trim(); if (!q) return [];
    return q.split(/[\s　]+/).map(function (w) {
      var i = I18N.PREF_KO.indexOf(w); if (i >= 0) w = PREFS[i];       // 韓国語の都道府県名も検索可
      return norm(w);
    }).filter(Boolean);
  }
  function refilter(resetFit) {
    var qs = queryTerms();
    var out = items.filter(function (v) { return matches(v, qs); });
    if (state.loc) {
      out.forEach(function (v) { v._d = dist(state.loc.lat, state.loc.lng, v.lat, v.lng); });
      if (state.r > 0) out = out.filter(function (v) { return v._d <= state.r; });
      out.sort(function (a, b) { return a._d - b._d; });
    } else out.forEach(function (v) { v._d = null; });
    state.filtered = out; state.shown = PAGE;
    renderList(); updateMarkers(resetFit);
  }

  function renderList() {
    var box = $('list'), list = state.filtered;
    var c = $('cnt'); c.textContent = '';
    if (state.loc && state.r > 0) {
      var s = t('resultsNear', { r: state.r + 'km', n: '§' }).split('§'); c.append(s[0]); c.append(el('b', '', list.length.toLocaleString())); c.append(s[1] || '');
    } else { var s2 = t('resultsAll', { n: '§' }).split('§'); c.append(el('b', '', list.length.toLocaleString())); c.append(s2[1] || ''); }
    box.textContent = '';
    if (!list.length) { box.appendChild(el('div', 'empty', t('noResult'))); return; }
    var frag = document.createDocumentFragment();
    list.slice(0, state.shown).forEach(function (v) {
      var it = el('div', 'item' + (state.sel === v ? ' on' : '')); it.dataset.id = v.id; it.appendChild(el('div', 'pl', '+'));
      var b = el('div'); b.appendChild(el('div', 't', v.name));
      var s = el('div', 's', I18N.prefName(v.pref, PREFS[v.pref]) + ' ' + v.city); if (v._d != null) s.appendChild(el('b', '', fmtKm(v._d))); b.appendChild(s);
      b.appendChild(el('div', 'ph' + (v.phone ? '' : ' no'), v.phone ? '📞 ' + v.phone : t('noPhone')));
      it.appendChild(b); it.addEventListener('click', function () { select(v, true); }); frag.appendChild(it);
    });
    box.appendChild(frag);
    if (list.length > state.shown) { var m = el('button', 'morebtn', t('more')); m.onclick = function () { state.shown += PAGE; renderList(); }; box.appendChild(m); }
  }

  function select(v, pan) {
    state.sel = v; renderDetail(v); $('detail').classList.add('open');
    var url = new URL(location.href); url.searchParams.set('id', v.id); history.replaceState(null, '', url);
    markActive(v);
    if (map && pan) { map.panTo({ lat: v.lat, lng: v.lng }); if (map.getZoom() < 15) map.setZoom(15); }
    highlightMarker(v);
  }
  function markActive(v) { document.querySelectorAll('.item').forEach(function (e) { e.classList.toggle('on', !!v && +e.dataset.id === v.id); }); }
  function renderDetail(v) {
    $('d-name').textContent = v.name;
    $('d-loc').textContent = I18N.prefName(v.pref, PREFS[v.pref]) + ' ' + v.city;
    var call = $('a-call'); if (v.phone) { call.href = 'tel:' + v.phone.replace(/[^0-9+]/g, ''); call.classList.remove('dis'); } else { call.removeAttribute('href'); call.classList.add('dis'); }
    $('a-route').href = 'https://www.google.com/maps/dir/?api=1&destination=' + v.lat + ',' + v.lng + '&destination_place_id=&travelmode=driving';
    var rows = $('d-rows'); rows.textContent = '';
    function row(icon, node) { var r = el('div', 'row'); r.appendChild(el('span', 'i', icon)); var b = el('div'); b.appendChild(node); r.appendChild(b); rows.appendChild(r); }
    var a = el('div', '', [PREFS[v.pref], v.city, v.address].filter(Boolean).join(' ')); if (v.postcode) a.appendChild(el('small', '', t('postcode') + v.postcode)); row('📍', a);
    if (v.phone) { var p = el('a', '', v.phone); p.href = 'tel:' + v.phone.replace(/[^0-9+]/g, ''); row('📞', p); } else row('📞', el('span', 'mut', t('noPhoneFull')));
    if (v.website) { var w = el('a', '', v.website.replace(/^https?:\/\//, '').replace(/\/$/, '')); w.href = v.website; w.target = '_blank'; w.rel = 'noopener noreferrer'; var wb = el('div'); wb.appendChild(el('small', '', t('website'))); wb.appendChild(w); row('🌐', wb); }
    var all = el('a', '', t('allIn', { c: v.city })); all.href = '#'; all.onclick = function (e) { e.preventDefault(); $('detail').classList.remove('open'); $('q').value = v.city; state.q = v.city; state.pref = v.pref; $('pref').value = v.pref; refilter(true); }; row('🗺️', all);
  }
  function closeDetail() { $('detail').classList.remove('open'); state.sel = null; var u = new URL(location.href); u.searchParams.delete('id'); history.replaceState(null, '', u); highlightMarker(null); markActive(null); }

  // ---- Google Maps ----
  var mapMsg = null;
  function showMapMsg(tk, bk) { mapMsg = [tk, bk]; drawMapMsg(); $('mapmsg').hidden = false; }
  function drawMapMsg() { if (mapMsg) { $('mm-t').textContent = t(mapMsg[0]); $('mm-b').textContent = mapMsg[1] ? t(mapMsg[1]) : ''; } }
  function loadMaps() {
    var key = (window.JPKVET_CONFIG || {}).GOOGLE_MAPS_API_KEY;
    if (!key) { showMapMsg('mapNoKeyTitle', 'mapNoKeyBody'); return; }
    window.__gmInit = initMap; window.gm_authFailure = function () { showMapMsg('mapLoadFail', ''); };
    var s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key) + '&callback=__gmInit&language=' + (I18N.lang === 'ko' ? 'ko' : 'ja') + '&region=JP&loading=async';
    s.async = true; s.onerror = function () { showMapMsg('mapLoadFail', ''); }; document.head.appendChild(s);
  }
  function initMap() {
    map = new google.maps.Map($('map'), { center: { lat: 36.2, lng: 138.25 }, zoom: 5, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: 'greedy' });
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/@googlemaps/markerclusterer@2.5.3/dist/index.min.js';
    s.onload = function () { mapReady = true; updateMarkers(true); if (state.sel) { map.setCenter({ lat: state.sel.lat, lng: state.sel.lng }); map.setZoom(15); } };
    s.onerror = function () { mapReady = true; updateMarkers(true); };
    document.head.appendChild(s);
  }
  function mk(v) {
    if (markers[v.id]) return markers[v.id];
    var m = new google.maps.Marker({ position: { lat: v.lat, lng: v.lng }, title: v.name, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
    m.addListener('click', function () { select(v, false); }); return (markers[v.id] = m);
  }
  function updateMarkers(fit) {
    if (!map || !mapReady) return;
    var list = state.filtered, ms = list.map(mk);
    if (clusterer) { clusterer.clearMarkers(); clusterer.addMarkers(ms); }
    else if (window.markerClusterer) clusterer = new markerClusterer.MarkerClusterer({ map: map, markers: ms });
    else { Object.keys(markers).forEach(function (k) { markers[k].setMap(null); }); ms.forEach(function (m) { m.setMap(map); }); }
    if (fit && list.length) {
      var b = new google.maps.LatLngBounds(); list.slice(0, 2000).forEach(function (v) { b.extend({ lat: v.lat, lng: v.lng }); });
      if (state.loc && state.r > 0) b.extend(state.loc); map.fitBounds(b, 60); if (list.length === 1) map.setZoom(15);
    }
  }
  function highlightMarker(v) {
    if (!map || !mapReady) return;
    if (selMarker) { selMarker.setMap(null); selMarker = null; }
    if (v) selMarker = new google.maps.Marker({ map: map, position: { lat: v.lat, lng: v.lng }, zIndex: 999, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 11, fillColor: '#ff5a5f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 } });
  }

  // ---- 現在地 ----
  var meMarker = null;
  function locate(thenRadius) {
    if (!navigator.geolocation) { toast(t('locFail')); return; }
    toast(t('locating'));
    navigator.geolocation.getCurrentPosition(function (p) {
      state.loc = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (thenRadius != null) setRadius(thenRadius, true); else if (state.r === 0) setRadius('5', true); else refilter(true);
      if (map) { if (meMarker) meMarker.setMap(null); meMarker = new google.maps.Marker({ map: map, position: state.loc, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#10b981', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 } }); }
    }, function () { toast(t('locFail')); }, { enableHighAccuracy: false, timeout: 10000 });
  }
  function setRadius(r, fit) {
    state.r = r === 'loc' ? state.r : (parseInt(r, 10) || 0);
    document.querySelectorAll('#rad button').forEach(function (b) { b.classList.toggle('on', b.dataset.r === String(r === 'loc' ? (state.r || 0) : r)); });
    refilter(fit !== false);
  }

  function fillPref() {
    var s = $('pref'), cur = state.pref; s.textContent = '';
    var o = el('option', '', t('prefAll')); o.value = -1; s.appendChild(o);
    PREFS.forEach(function (p, i) { var op = el('option', '', I18N.prefName(i, p)); op.value = i; s.appendChild(op); });
    s.value = cur;
  }

  function init(d) {
    PREFS = d.prefectures;
    items = d.items.map(function (a) { var v = { id: a[0], name: a[1], pref: a[2], city: a[3], postcode: a[4], address: a[5], phone: a[6], website: a[7], lat: a[8], lng: a[9] };
      v._s = norm([v.name, PREFS[v.pref], v.city, v.address, v.postcode].join('')); return v; });
    var qp = new URLSearchParams(location.search);
    state.q = qp.get('q') || ''; $('q').value = state.q; fillPref(); I18N.apply();
    var id = qp.get('id'); if (id !== null) { var f = items[+id]; if (f) { state.sel = f; renderDetail(f); $('detail').classList.add('open'); } }
    refilter(true); loadMaps();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var timer; $('q').addEventListener('input', function (e) { clearTimeout(timer); timer = setTimeout(function () { state.q = e.target.value; refilter(true); }, 200); });
    $('pref').addEventListener('change', function (e) { state.pref = +e.target.value; refilter(true); });
    $('rad').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var r = b.dataset.r;
      if (r === 'loc') return locate(); if (r !== '0' && !state.loc) return locate(r); setRadius(r, true); });
    $('locbtn').addEventListener('click', function () { locate(); });
    $('dx').addEventListener('click', closeDetail);
    $('a-copy').addEventListener('click', function () { if (state.sel) navigator.clipboard && navigator.clipboard.writeText(fullAddr(state.sel)).then(function () { toast(t('copied')); }); });
    $('a-share').addEventListener('click', function () { var u = location.href, v = state.sel; if (navigator.share) navigator.share({ title: v.name, url: u }).catch(function () {}); else navigator.clipboard.writeText(u).then(function () { toast(t('linkCopied')); }); });
    fetch('data/vets.json').then(function (r) { return r.json(); }).then(init);
  });
  document.addEventListener('langchange', function () { if (!PREFS.length) return; fillPref(); renderList(); if (state.sel) renderDetail(state.sel); drawMapMsg(); I18N.apply(); });
})();
