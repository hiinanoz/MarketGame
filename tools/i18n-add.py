#!/usr/bin/env python3
"""Çevirileri dil dosyalarına ekler/günceller (sıralı, okunaklı JSON).

  python3 tools/i18n-add.py çeviriler.json
Girdi: { "Türkçe metin": { "en": "…", "de": "…", "es": "…", "fr": "…", "it": "…", "ko": "…", "ja": "…" }, … }
   ya da kısa biçim: { "Türkçe metin": ["en", "de", "es", "fr", "it", "ko", "ja"], … }
"""
import json
import os
import sys

LANGS = ['en', 'de', 'es', 'fr', 'it', 'ko', 'ja']
DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'locales')

new = json.load(open(sys.argv[1], encoding='utf-8'))
new = {k: dict(zip(LANGS, v)) if isinstance(v, list) else v for k, v in new.items()}
for lang in LANGS:
    path = os.path.join(DIR, f'{lang}.json')
    d = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    n = 0
    for key, tr in new.items():
        if lang in tr:
            d[key] = tr[lang]
            n += 1
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(d.items())), f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(f'{lang}: +{n} ({len(d)} toplam)')
