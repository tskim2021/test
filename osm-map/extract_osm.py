"""OSM PBF에서 POI 추출 -> JSON 행 목록(data.js 형식).
사용법: python3 extract_osm.py <japan.osm.pbf> <out.js> <변수명> <태그키=값>
예: python3 extract_osm.py japan.osm.pbf repair_data.js REPAIR shop=car_repair
행 형식: [이름, 도도부현, 시구정촌, 주소, 전화, 웹사이트, 경도, 위도, 출처]
"""
import sys, json
import osmium

pbf, out, var, tag = sys.argv[1:5]
k, v = tag.split("=")

class H(osmium.SimpleHandler):
    def __init__(self):
        super().__init__(); self.rows = []
    def _add(self, o, lon, lat):
        t = o.tags
        if t.get(k) != v: return
        name = t.get("name:ja") or t.get("name")
        addr = " ".join(x for x in (t.get("addr:city"), t.get("addr:suburb"), t.get("addr:quarter"),
                                    t.get("addr:neighbourhood"), t.get("addr:block_number"),
                                    t.get("addr:housenumber")) if x)
        self.rows.append([name, t.get("addr:province"), t.get("addr:city"), addr or None,
                          t.get("phone") or t.get("contact:phone"),
                          t.get("website") or t.get("contact:website"),
                          round(lon, 5), round(lat, 5), "osm"])
    def node(self, n):
        if n.tags.get(k) == v and n.location.valid(): self._add(n, n.location.lon, n.location.lat)
    def area(self, a):
        if a.tags.get(k) != v: return
        try:
            c = next(iter(a.outer_rings()))
            pts = [(n.lon, n.lat) for n in c]
            self._add(a, sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts))
        except Exception: pass

h = H()
# 인덱스 없이 area 처리 위해 location 캐시 사용
h.apply_file(pbf, locations=True)
print(len(h.rows), "rows", file=sys.stderr)
with open(out, "w", encoding="utf-8") as f:
    f.write(f"const {var}=" + json.dumps(h.rows, ensure_ascii=False, separators=(",", ":")) + ";\n")
