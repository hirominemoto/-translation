"""翻訳データ（data/dictionary.json）を仕様書のルールに沿ってチェックする。

チェック内容:
  1. 語リスト（data/emotion-words.csv）と id・語・語義が一致しているか
  2. 必須欄が埋まっているか
  3. 禁止語が混ざっていないか（仕様書 6-1）
  4. 因子の組み合わせがまったく同じ語がないか（仕様書 4）

使い方: python3 scripts/check_dictionary.py
"""

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDS_CSV = ROOT / "data" / "emotion-words.csv"
DICTIONARY_JSON = ROOT / "data" / "dictionary.json"

REQUIRED_FIELDS = ["summary", "trigger", "state", "output", "difference", "onReceive"]
FACTOR_KEYS = ["goal", "prediction", "agency", "control", "time", "certainty", "social", "intensity"]

# 「」で囲んだ部分を引用（語名や発話の例）として扱い、禁止語チェックから外す欄
QUOTE_ALLOWED_FIELDS = {"difference", "onReceive", "patterns"}

# 感情語の漢字・ひらがなの表記ゆれと、感覚・欲求・身体の語（仕様書 6-1）
BANNED_EXTRA = [
    "嬉し", "楽し", "悲し", "怒", "怖", "恐", "驚", "嫌", "寂し", "淋し", "悔し", "恥",
    "切な", "懐かし", "虚し", "喜", "憎", "愛", "恋", "幸", "苦", "痛", "辛",
    "好", "畏", "安心", "不安", "満足", "不満", "緊張",
    "感じ", "感覚", "感情", "感動", "気持ち", "気分", "心", "快",
    "望", "願", "欲", "ほしい",
    "胸", "腹", "頭にくる", "手が届",
    "ポジティブ", "ネガティブ",
]

# 禁止語を含むが、意味としては問題ない語
ALLOWED_COMPOUNDS = ["中心", "重心", "核心", "不安定", "大切", "適切"]

# 「〜たい」「〜たくなる」「〜たがる」など欲求の言い回し
DESIRE_PATTERN = re.compile(r"[ぁ-んァ-ヶ一-龥]た(?:い(?=[。、とのがはもかでな）)」]|$)|く(?:な|て)|が[るっ])")
DESIRE_ALLOWED = ["冷たい", "重たい", "平たい", "めでたい"]
EXPECTATION_PATTERN = re.compile(r"期待(?!値)")


def load_words():
    with WORDS_CSV.open(encoding="utf-8") as f:
        return {int(row["id"]): row for row in csv.DictReader(f)}


def label(entry):
    return f"{entry['word']}（{entry['sense']}）" if entry.get("sense") else entry["word"]


def mask_allowed(text, field):
    if field in QUOTE_ALLOWED_FIELDS:
        text = re.sub(r"「[^」]*」", "□", text)
    for word in ALLOWED_COMPOUNDS + DESIRE_ALLOWED:
        text = text.replace(word, "□")
    return text


def find_banned(text, field, banned_words):
    masked = mask_allowed(text, field)
    hits = [w for w in banned_words if w in masked]
    hits += [m.group(0) for m in DESIRE_PATTERN.finditer(masked)]
    hits += [m.group(0) for m in EXPECTATION_PATTERN.finditer(masked)]
    return hits


def main():
    words = load_words()
    entries = json.loads(DICTIONARY_JSON.read_text(encoding="utf-8"))
    banned_words = sorted({row["語"] for row in words.values()} | set(BANNED_EXTRA), key=len, reverse=True)
    errors = []

    seen_ids = set()
    for entry in entries:
        name = label(entry)
        row = words.get(entry["id"])
        if row is None:
            errors.append(f"{name}: id {entry['id']} が語リストにない")
        elif (row["語"], row["語義"]) != (entry["word"], entry.get("sense", "")):
            errors.append(f"{name}: 語リストの id {entry['id']}（{row['語']} {row['語義']}）と一致しない")
        if entry["id"] in seen_ids:
            errors.append(f"{name}: id {entry['id']} が重複している")
        seen_ids.add(entry["id"])

        for field in REQUIRED_FIELDS:
            if not entry.get(field, "").strip():
                errors.append(f"{name}: {field} が空")
        missing = [k for k in FACTOR_KEYS if k not in entry.get("factors", {})]
        if missing:
            errors.append(f"{name}: 因子が足りない {missing}")

        texts = [(field, entry.get(field, "")) for field in ["summary"] + REQUIRED_FIELDS[1:]]
        texts += [("patterns", p["name"] + " " + p["text"]) for p in entry.get("patterns", [])]
        for field, text in texts:
            hits = find_banned(text, field, banned_words)
            if hits:
                errors.append(f"{name}: {field} に禁止語 {sorted(set(hits))}")

    by_factors = {}
    for entry in entries:
        key = tuple(str(entry.get("factors", {}).get(k)) for k in FACTOR_KEYS)
        by_factors.setdefault(key, []).append(label(entry))
    for names in by_factors.values():
        if len(names) > 1:
            errors.append(f"因子がまったく同じ: {' / '.join(names)}")

    print(f"翻訳済み: {len(entries)} / {len(words)} 語")
    if errors:
        print(f"NG: {len(errors)} 件")
        for e in errors:
            print("  - " + e)
        sys.exit(1)
    print("OK: 問題なし")


if __name__ == "__main__":
    main()
