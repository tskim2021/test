#!/usr/bin/env python3
"""data/jp_vets_final.csv -> data/vets.json (웹용 컴팩트 배열). 사용: python3 scripts/build_data.py"""
import csv, json, os, phonenumbers as pn
here = os.path.dirname(os.path.abspath(__file__)); d = os.path.join(here, '..', 'data')
def phone(p):
    if not p: return ''
    try: return pn.format_number(pn.parse(p, 'JP'), pn.PhoneNumberFormat.NATIONAL)
    except Exception: return p
def site(u):
    u = (u or '').strip()
    return u if u.startswith(('http://', 'https://')) else ('https://' + u if u else '')
rows = list(csv.DictReader(open(os.path.join(d, 'jp_vets_final.csv'), encoding='utf-8-sig')))
PREF = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split()
out = []
for i, x in enumerate(rows):
    out.append([i, x['name'], PREF.index(x['prefecture']), x['city'], x['postcode'], x['address'],
                phone(x['phone']), site(x['website']), round(float(x['lat']), 5), round(float(x['lon']), 5)])
json.dump({'prefectures': PREF, 'fields': ['id', 'name', 'pref', 'city', 'postcode', 'address', 'phone', 'website', 'lat', 'lng'], 'items': out},
          open(os.path.join(d, 'vets.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'items', os.path.getsize(os.path.join(d, 'vets.json')) // 1024, 'KB')
