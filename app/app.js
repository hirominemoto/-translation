(function () {
  "use strict";

  var data = window.EMOTION_DICTIONARY;
  var entries = data.entries;

  var FIELDS = [
    ["trigger", "発生条件"],
    ["state", "内部状態"],
    ["output", "出力傾向"]
  ];
  var FACTORS = [
    ["goal", "目標一致"],
    ["prediction", "予測とのズレ"],
    ["agency", "原因の所在"],
    ["control", "制御可能性"],
    ["time", "時間軸"],
    ["certainty", "確実性"],
    ["social", "他者の評価"],
    ["intensity", "強度"]
  ];
  var SEARCH_FIELDS = ["summary", "trigger", "state", "output", "difference", "onReceive"];
  var WIDE = window.matchMedia("(min-width: 900px)");

  var byId = {};
  var byName = {};
  entries.forEach(function (e) {
    byId[e.id] = e;
    (byName[e.word] = byName[e.word] || []).push(e);
    if (e.sense) byName[e.label] = [e];
  });

  var state = { query: "", category: "", currentId: null, listScroll: 0 };

  var els = {
    q: document.getElementById("q"),
    categories: document.getElementById("categories"),
    index: document.getElementById("index"),
    entry: document.getElementById("entry"),
    tools: document.getElementById("tools"),
    meta: document.getElementById("meta")
  };

  // ---- helpers ----

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // カタカナをひらがなに寄せ、英字を小文字にする。1文字ずつの置き換えなので位置はずれない
  function normalize(s) {
    return String(s)
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  }

  function pad(n) { return ("00" + n).slice(-3); }

  function translationText(e) {
    var parts = SEARCH_FIELDS.map(function (k) { return e[k]; });
    e.patterns.forEach(function (p) { parts.push(p.name + "：" + p.text); });
    return parts.join("　");
  }

  function headwordMatch(e, nq) {
    return [e.word, e.label, e.reading, e.sense].some(function (s) { return normalize(s).indexOf(nq) !== -1; });
  }

  function snippet(text, nq) {
    var at = normalize(text).indexOf(nq);
    if (at === -1) return esc(text.slice(0, 60));
    var start = Math.max(0, at - 18);
    var end = Math.min(text.length, at + nq.length + 30);
    return (start > 0 ? "…" : "") +
      esc(text.slice(start, at)) +
      "<mark>" + esc(text.slice(at, at + nq.length)) + "</mark>" +
      esc(text.slice(at + nq.length, end)) +
      (end < text.length ? "…" : "");
  }

  function factorBase(v) {
    return String(v).split("／")[0].replace(/（.*?）/g, "");
  }

  function similarEntries(e) {
    return entries
      .filter(function (o) { return o.id !== e.id; })
      .map(function (o) {
        var score = FACTORS.filter(function (f) {
          return factorBase(o.factors[f[0]]) === factorBase(e.factors[f[0]]);
        }).length;
        return { entry: o, score: score };
      })
      .sort(function (a, b) { return b.score - a.score || a.entry.id - b.entry.id; })
      .slice(0, 4);
  }

  // 「語」を、辞書にある別の語ならその項目へのリンクにする
  function linkify(text, selfId) {
    return esc(text).replace(/「([^」]+)」/g, function (whole, name) {
      var hit = byName[name];
      return hit && hit[0].id !== selfId ? '<a href="#e' + hit[0].id + '">' + whole + "</a>" : whole;
    });
  }

  function copyText(e) {
    var lines = [
      "【感情語の翻訳：" + e.label + "】",
      "人間がこの語を使うとき、その人の中で起きていることを、AIの仕組みの言葉で描写したものです。",
      "",
      "ひとこと：" + e.summary,
      "発生条件：" + e.trigger,
      "内部状態：" + e.state,
      "出力傾向：" + e.output
    ];
    e.patterns.forEach(function (p) { lines.push("パターン（" + p.name + "）：" + p.text); });
    lines.push("近い語との違い：" + e.difference);
    lines.push("この語を受け取ったら：" + e.onReceive);
    return lines.join("\n");
  }

  // ---- rendering ----

  function renderCategories() {
    var items = [["", "すべて"]].concat(data.categories.map(function (c) { return [c, c]; }));
    els.categories.innerHTML = items.map(function (c) {
      return '<button type="button" class="chip" data-category="' + esc(c[0]) + '" aria-pressed="' +
        (state.category === c[0]) + '">' + esc(c[1]) + "</button>";
    }).join("");
  }

  function indexItem(e, gloss) {
    var current = e.id === state.currentId ? ' aria-current="true"' : "";
    return '<a class="index-item" href="#e' + e.id + '"' + current + ">" +
      '<span class="index-no">' + pad(e.id) + "</span>" +
      '<span class="index-word">' + esc(e.word) +
      (e.sense ? ' <span class="index-sense">（' + esc(e.sense) + "）</span>" : "") + "</span>" +
      '<span class="index-gloss">' + gloss + "</span></a>";
  }

  function group(title, count, items) {
    return '<section class="index-group"><h2 class="index-heading"><span>' + esc(title) +
      "</span><span>" + count + "語</span></h2>" + items + "</section>";
  }

  function renderIndex() {
    var pool = entries.filter(function (e) { return !state.category || e.category === state.category; });
    var nq = normalize(state.query.trim());
    var html;

    if (!nq) {
      var cats = state.category ? [state.category] : data.categories;
      html = cats.map(function (c) {
        var list = pool.filter(function (e) { return e.category === c; });
        return group(c, list.length, list.map(function (e) { return indexItem(e, esc(e.summary)); }).join(""));
      }).join("");
    } else {
      var heads = pool.filter(function (e) { return headwordMatch(e, nq); });
      var texts = pool.filter(function (e) {
        return heads.indexOf(e) === -1 && normalize(translationText(e)).indexOf(nq) !== -1;
      });
      html = "";
      if (heads.length) {
        html += group("見出し語", heads.length, heads.map(function (e) { return indexItem(e, esc(e.summary)); }).join(""));
      }
      if (texts.length) {
        html += group("AIの言葉から（逆引き）", texts.length, texts.map(function (e) {
          return indexItem(e, snippet(translationText(e), nq));
        }).join(""));
      }
      if (!html) {
        html = '<p class="index-empty">「' + esc(state.query.trim()) +
          "」に一致する語はありません。ひらがなや、別の言い方で試してみてください。</p>";
      }
    }
    els.index.innerHTML = html;
  }

  function renderEntry(e) {
    var fields = FIELDS.map(function (f) {
      return '<div class="field"><dt>' + f[1] + "</dt><dd>" + esc(e[f[0]]) + "</dd></div>";
    }).join("");
    fields += e.patterns.map(function (p) {
      return '<div class="field"><dt>パターン：' + esc(p.name) + "</dt><dd>" + esc(p.text) + "</dd></div>";
    }).join("");
    fields += '<div class="field"><dt>近い語との違い</dt><dd>' + linkify(e.difference, e.id) + "</dd></div>";
    fields += '<div class="field field-receive"><dt>この語を受け取ったら</dt><dd>' + linkify(e.onReceive, e.id) + "</dd></div>";

    var readout = FACTORS.map(function (f) {
      var v = e.factors[f[0]];
      var value = esc(v);
      if (f[0] === "intensity") {
        value += '<span class="meter" aria-hidden="true">' +
          [1, 2, 3].map(function (n) { return '<i class="' + (n <= v ? "on" : "") + '"></i>'; }).join("") +
          "</span>";
      }
      return '<div class="readout-row"><dt>' + f[1] + "</dt><dd>" + value + "</dd></div>";
    }).join("");

    var near = [];
    e.near.forEach(function (w) { (byName[w] || []).forEach(function (o) { near.push(o); }); });
    var nearHtml = near.map(function (o) {
      return '<li><a class="link-chip" href="#e' + o.id + '"><strong>' + esc(o.label) + "</strong></a></li>";
    }).join("");
    var similarHtml = similarEntries(e).map(function (s) {
      return '<li><a class="link-chip" href="#e' + s.entry.id + '"><strong>' + esc(s.entry.label) +
        "</strong><span>8因子中" + s.score + "一致</span></a></li>";
    }).join("");

    els.entry.innerHTML =
      '<button type="button" class="back" id="back">← 一覧へ</button>' +
      '<header class="entry-head">' +
        '<p class="entry-meta">No.' + pad(e.id) + " ・ " + esc(e.category) + "</p>" +
        '<h2 class="headword">' + esc(e.word) +
          (e.sense ? '<span class="headword-sense">（' + esc(e.sense) + "）</span>" : "") + "</h2>" +
        '<p class="reading">' + esc(e.reading) + "</p>" +
        '<div class="copy-row"><button type="button" class="copy" id="copy">AIに渡す文章をコピー</button>' +
          '<span class="copy-status" id="copy-status" role="status"></span></div>' +
      "</header>" +
      '<section class="side side-human" aria-label="人間の言葉">' +
        '<h3 class="side-label">人間の言葉</h3>' +
        '<p class="meaning">' + esc(e.meaning) + "</p>" +
        '<p class="example">' + esc(e.example) + "</p>" +
      "</section>" +
      '<div class="translate-mark" aria-hidden="true">↓ AIの言葉に翻訳</div>' +
      '<section class="side side-machine" aria-label="AIの言葉">' +
        '<h3 class="side-label">AIの言葉</h3>' +
        '<p class="summary">' + esc(e.summary) + "</p>" +
        '<dl class="fields">' + fields + "</dl>" +
      "</section>" +
      '<section class="factors" aria-label="因子">' +
        '<h3 class="section-title">因子</h3>' +
        '<dl class="readout">' + readout + "</dl>" +
      "</section>" +
      '<section class="related">' +
        (nearHtml ? '<div class="related-block"><h3 class="section-title">近い語</h3><ul class="links">' + nearHtml + "</ul></div>" : "") +
        '<div class="related-block"><h3 class="section-title">因子が近い語</h3><ul class="links">' + similarHtml + "</ul></div>" +
      "</section>";
    document.title = e.label + " | 感情語翻訳辞書";
  }

  // ---- routing ----

  function currentFromHash() {
    var m = /^#e(\d+)$/.exec(location.hash);
    return m && byId[m[1]] ? Number(m[1]) : null;
  }

  function route() {
    var id = currentFromHash();
    var wasReading = !els.entry.hidden && !WIDE.matches;

    if (WIDE.matches) {
      state.currentId = id || state.currentId || entries[0].id;
      els.index.hidden = false;
      els.entry.hidden = false;
      renderEntry(byId[state.currentId]);
    } else if (id) {
      if (els.entry.hidden) state.listScroll = window.scrollY;
      state.currentId = id;
      els.index.hidden = true;
      els.entry.hidden = false;
      renderEntry(byId[id]);
      window.scrollTo(0, 0);
    } else {
      els.entry.hidden = true;
      els.index.hidden = false;
      document.title = "感情語翻訳辞書";
      if (wasReading) window.scrollTo(0, state.listScroll);
    }
    renderIndex();
  }

  // ---- events ----

  els.q.addEventListener("input", function () {
    state.query = els.q.value;
    if (!WIDE.matches && !els.entry.hidden) location.hash = "list";
    renderIndex();
  });

  els.categories.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".chip");
    if (!btn) return;
    state.category = btn.getAttribute("data-category");
    renderCategories();
    if (!WIDE.matches && !els.entry.hidden) location.hash = "list";
    renderIndex();
  });

  els.entry.addEventListener("click", function (ev) {
    if (ev.target.closest("#back")) {
      location.hash = "list";
      return;
    }
    var copyBtn = ev.target.closest("#copy");
    if (!copyBtn) return;
    var e = byId[state.currentId];
    var text = copyText(e);
    var status = document.getElementById("copy-status");
    function fallback() {
      var area = document.getElementById("copy-fallback");
      if (!area) {
        area = document.createElement("textarea");
        area.id = "copy-fallback";
        area.className = "copy-fallback";
        area.readOnly = true;
        copyBtn.parentNode.appendChild(area);
      }
      area.value = text;
      area.focus();
      area.select();
      status.textContent = "自動でコピーできませんでした。下の文章を選択してコピーしてください。";
    }
    try {
      navigator.clipboard.writeText(text).then(function () {
        status.textContent = "コピーしました。AIとの会話に貼り付けて使えます。";
      }, fallback);
    } catch (err) {
      fallback();
    }
  });

  window.addEventListener("hashchange", route);
  WIDE.addEventListener("change", route);

  function measureTools() {
    document.documentElement.style.setProperty("--tools-h", els.tools.offsetHeight + "px");
  }
  window.addEventListener("resize", measureTools);

  els.meta.textContent = entries.length + "語 ・ 翻訳仕様書 " + data.specVersion;
  renderCategories();
  measureTools();
  route();
})();
