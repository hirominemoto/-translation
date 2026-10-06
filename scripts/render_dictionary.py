"""翻訳データ（data/dictionary.json）から、レビュー用の docs/dictionary.md を生成する。

使い方: python3 scripts/render_dictionary.py
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS_CSV = ROOT / "data" / "emotion-words.csv"
DICTIONARY_JSON = ROOT / "data" / "dictionary.json"
OUTPUT_MD = ROOT / "docs" / "dictionary.md"

FIELDS = [
    ("summary", "ひとこと"),
    ("trigger", "発生条件"),
    ("state", "内部状態"),
    ("output", "出力傾向"),
    ("difference", "近い語との違い"),
    ("onReceive", "この語を受け取ったら"),
]
FACTORS = [
    ("goal", "目標一致"),
    ("prediction", "予測とのズレ"),
    ("agency", "原因の所在"),
    ("control", "制御可能性"),
    ("time", "時間軸"),
    ("certainty", "確実性"),
    ("social", "他者の評価"),
    ("intensity", "強度"),
]


def label(word, sense):
    return f"{word}（{sense}）" if sense else word


def render_entry(entry, row):
    lines = [
        f"### 【{label(entry['word'], entry.get('sense'))}】",
        "",
        f"{row['読み']}｜{row['カテゴリ']}｜{row['意味（ふつうの日本語）']}",
        "",
        "| 欄 | 内容 |",
        "|---|---|",
    ]
    for key, name in FIELDS[:4]:
        lines.append(f"| {name} | {entry[key]} |")
    for pattern in entry.get("patterns", []):
        lines.append(f"| パターン：{pattern['name']} | {pattern['text']} |")
    for key, name in FIELDS[4:]:
        lines.append(f"| {name} | {entry[key]} |")
    factors = " ｜ ".join(f"{name} {entry['factors'][key]}" for key, name in FACTORS)
    lines += ["", f"因子：{factors}", ""]
    return lines


def main():
    with WORDS_CSV.open(encoding="utf-8") as f:
        rows = {int(row["id"]): row for row in csv.DictReader(f)}
    entries = sorted(json.loads(DICTIONARY_JSON.read_text(encoding="utf-8")), key=lambda e: e["id"])
    done = {e["id"] for e in entries}

    lines = [
        "# 感情語翻訳辞書（レビュー用）",
        "",
        "> このファイルは `python3 scripts/render_dictionary.py` で `data/dictionary.json` から自動生成している。直接編集しないこと。",
        "",
        f"翻訳済み：{len(entries)} / {len(rows)} 語",
        "",
    ]
    for category in dict.fromkeys(row["カテゴリ"] for row in rows.values()):
        lines += [f"## {category}", ""]
        for entry in entries:
            row = rows[entry["id"]]
            if row["カテゴリ"] == category:
                lines += render_entry(entry, row)
        todo = [label(r["語"], r["語義"]) for i, r in rows.items() if r["カテゴリ"] == category and i not in done]
        if todo:
            lines += [f"未翻訳：{'、'.join(todo)}", ""]

    OUTPUT_MD.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"{OUTPUT_MD.relative_to(ROOT)} を生成（{len(entries)} 語）")


if __name__ == "__main__":
    main()
