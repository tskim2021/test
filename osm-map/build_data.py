"""jp_vets.xlsx(全国 시트) -> data.js (중복 제거 후 지도용 JSON)
사용법: python3 build_data.py <xlsx> <out data.js> [변수명]
"""
import sys, json, pandas as pd

xlsx, out = sys.argv[1], sys.argv[2]
var = sys.argv[3] if len(sys.argv) > 3 else "VETS"
df = pd.read_excel(xlsx, sheet_name="全国")
n0 = len(df)
# 이름+주소 중복: 신뢰도 높은 행만 남김 (NaN은 0 취급)
df["_c"] = df["신뢰도"].fillna(0)
df = df.sort_values("_c", ascending=False).drop_duplicates(["병원명", "주소"]).sort_index()
rows = []
for r in df.itertuples(index=False):
    g = lambda k: None if pd.isna(getattr(r, k)) else getattr(r, k)
    rows.append([g("병원명"), g("도도부현"), g("시구정촌"), g("주소"), g("전화번호"),
                 g("웹사이트"), round(r.경도, 5), round(r.위도, 5), g("출처")])
json.dump({"n_raw": n0}, sys.stderr)
print(f"\nraw={n0} dedup={len(rows)}", file=sys.stderr)
with open(out, "w", encoding="utf-8") as f:
    f.write(f"const {var}=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n")
