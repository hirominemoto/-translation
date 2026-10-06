## AI用感情語翻訳ツール

AIとコミュニケーションをとるための翻訳ツール。

人間の感情語を、感情・感覚・欲求の語彙を使わずに「AIの仕組みの言葉」へ置き換えて（因数分解して）、**AIに人間の感情をできるだけ正確に伝える**ことを目指す。

### 進め方

| STEP | 内容 | 成果物 | 状態 |
|---|---|---|---|
| 0 | 翻訳ルールを決める | [`docs/translation-spec.md`](docs/translation-spec.md) | v0.3 |
| 1 | 感情語を集める | [`data/emotion-words.csv`](data/emotion-words.csv) | 55項目（53語、うち3語は意味ごとに分割） |
| 2 | 翻訳する（試訳 → レビュー → 残りを翻訳 → 自動チェック → 最終レビュー） | [`data/dictionary.json`](data/dictionary.json) ／ 表示用 [`docs/dictionary.md`](docs/dictionary.md) | 55 / 55（レビュー2回反映） |
| 3 | アプリにする（静的Webアプリ） | [`app/`](app/) | 初版 |

### 方針

- 人間側の感情の中身は**正確に**、AI側の仕組みの描写は**わかりやすさ優先**（比喩OK）
- 感情語を「目標一致」「予測とのズレ」「原因の所在」などの因子に分解し、似た感情との違いをはっきりさせる

### アプリ

`app/index.html` をブラウザで開くだけで動く（サーバー不要）。

- 語・読み（ひらがな／カタカナどちらでも）で探す
- AIの言葉で逆引きする（例：「予測誤差」「キュー」）
- カテゴリで絞り込む
- 各語の「AIに渡す文章をコピー」で、翻訳をそのままAIとの会話に貼り付けられる
- 近い語・因子が近い語へ移動できる

### 翻訳を追加・修正したら

```
python3 scripts/check_dictionary.py && python3 scripts/render_dictionary.py && python3 scripts/build_app_data.py
```

禁止語・因子の重複などをチェックして、レビュー用の `docs/dictionary.md` と、アプリ用の `app/data.js` を再生成する。
