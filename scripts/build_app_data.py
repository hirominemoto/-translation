"""語リスト（data/emotion-words.csv）と翻訳データ（data/dictionary.json）をまとめて、
アプリが読み込む app/data.js を生成する。

data.js は `window.EMOTION_DICTIONARY` を定義するだけのスクリプトなので、
サーバーなしで app/index.html を直接開いても動く。

使い方: python3 scripts/build_app_data.py
"""

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS_CSV = ROOT / "data" / "emotion-words.csv"
DICTIONARY_JSON = ROOT / "data" / "dictionary.json"
SPEC_MD = ROOT / "docs" / "translation-spec.md"
OUTPUT_JS = ROOT / "app" / "data.js"


def spec_version():
    match = re.search(r"仕様書（(v[\d.]+)）", SPEC_MD.read_text(encoding="utf-8"))
    return match.group(1) if match else ""


def main():
    with WORDS_CSV.open(encoding="utf-8") as f:
        rows = {int(row["id"]): row for row in csv.DictReader(f)}
    translations = {e["id"]: e for e in json.loads(DICTIONARY_JSON.read_text(encoding="utf-8"))}

    entries = []
    for entry_id, row in sorted(rows.items()):
        t = translations.get(entry_id)
        if t is None:
            continue
        sense = row["語義"]
        entries.append({
            "id": entry_id,
            "word": row["語"],
            "sense": sense,
            "label": f"{row['語']}（{sense}）" if sense else row["語"],
            "reading": row["読み"],
            "category": row["カテゴリ"],
            "meaning": row["意味（ふつうの日本語）"],
            "near": [w for w in row["近い語"].split("／") if w],
            "example": row["例文"],
            "summary": t["summary"],
            "trigger": t["trigger"],
            "state": t["state"],
            "output": t["output"],
            "patterns": t.get("patterns", []),
            "difference": t["difference"],
            "onReceive": t["onReceive"],
            "factors": t["factors"],
        })

    data = {
        "specVersion": spec_version(),
        "categories": list(dict.fromkeys(row["カテゴリ"] for row in rows.values())),
        "entries": entries,
    }
    OUTPUT_JS.parent.mkdir(exist_ok=True)
    OUTPUT_JS.write_text(
        "// このファイルは scripts/build_app_data.py で自動生成している。直接編集しないこと。\n"
        f"window.EMOTION_DICTIONARY = {json.dumps(data, ensure_ascii=False, indent=1)};\n",
        encoding="utf-8",
    )
    print(f"{OUTPUT_JS.relative_to(ROOT)} を生成（{len(entries)} 語、仕様書 {data['specVersion']}）")


if __name__ == "__main__":
    main()
