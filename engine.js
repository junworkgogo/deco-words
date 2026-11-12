"use strict";

const $ = (id) => document.getElementById(id);
const RULES = $("rules").textContent;
// 劍橋字典 英語-漢語（繁體）的單字頁：https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/<單字>
const CAMBRIDGE = "https://dictionary.cambridge.org/zht/%E8%A9%9E%E5%85%B8/%E8%8B%B1%E8%AA%9E-%E6%BC%A2%E8%AA%9E-%E7%B9%81%E9%AB%94/";
const API = "https://generativelanguage.googleapis.com/v1beta/";
const LS_KEY = "decoWords.geminiKey";
const LS_MODEL = "decoWords.model.v3"; // 換了選模型的規則，舊的記錄（decoWords.geminiModel、decoWords.model.v2）不再沿用

// Gemini 回傳 JSON 的格式（只用最基本的欄位，避免 API 不認得）
const WORD_SCHEMA = {
  type: "OBJECT",
  properties: { w: { type: "STRING" }, lemma: { type: "STRING" }, pos: { type: "STRING" }, zh: { type: "STRING" } },
  required: ["w", "lemma", "pos", "zh"],
};
// 主標、副標的翻譯：一句英文＋它的實詞清單
const TITLE_SCHEMA = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING" },
    // 2 個純單字的翻譯（2026-11-05 加）；字典小卡不用，所以沒有 words
    oneWords: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { text: { type: "STRING" }, zh: { type: "STRING" } },
        required: ["text", "zh"],
      },
    },
    words: { type: "ARRAY", items: WORD_SCHEMA },
  },
  required: ["text", "oneWords", "words"],
};
const SCHEMA = {
  type: "OBJECT",
  properties: {
    notes: { type: "ARRAY", items: { type: "STRING" } },
    headline: TITLE_SCHEMA,
    subhead: TITLE_SCHEMA,
    accents: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { text: { type: "STRING" }, zh: { type: "STRING" }, words: { type: "ARRAY", items: WORD_SCHEMA } },
        required: ["text", "zh", "words"],
      },
    },
    paragraph: {
      type: "OBJECT",
      properties: { text: { type: "STRING" }, gist: { type: "STRING" }, words: { type: "ARRAY", items: WORD_SCHEMA } },
      required: ["text", "gist", "words"],
    },
  },
  required: ["notes", "headline", "accents", "paragraph"],
};

const EXAMPLE = {
  title: "城心靜域",
  sub: "繁華中心的靜謐居所",
  notes: [],
  headline: {
    text: "Stillness at the city's heart",
    words: [
      { lemma: "stillness", pos: "名詞", zh: "寂靜，平靜" },
      { lemma: "city", pos: "名詞", zh: "城市，都市" },
      { lemma: "heart", pos: "名詞", zh: "中心，核心" },
    ],
  },
  subhead: {
    text: "A tranquil residence at the center of a bustling city",
    words: [
      { lemma: "tranquil", pos: "形容詞", zh: "寧靜的，平靜的" },
      { lemma: "residence", pos: "名詞", zh: "住宅，住所" },
      { lemma: "center", pos: "名詞", zh: "中心，中央" },
      { lemma: "bustling", pos: "形容詞", zh: "熙熙攘攘的，繁忙的" },
      { lemma: "city", pos: "名詞", zh: "城市，都市" },
    ],
  },
  accents: [
    {
      text: "Urban sanctuary",
      zh: "都會中的靜謐居所",
      words: [
        { lemma: "urban", pos: "形容詞", zh: "城市的，都市的" },
        { lemma: "sanctuary", pos: "名詞", zh: "庇護所，避難所" },
      ],
    },
    {
      text: "A quiet address",
      zh: "一處寧靜的居所",
      words: [
        { lemma: "quiet", pos: "形容詞", zh: "安靜的，寧靜的" },
        { lemma: "address", pos: "名詞", zh: "地址，住址" },
      ],
    },
    {
      text: "Room to breathe",
      zh: "可以從容呼吸的空間",
      words: [
        { lemma: "room", pos: "名詞", zh: "空間，餘地" },
        { lemma: "breathe", pos: "動詞", zh: "呼吸" },
      ],
    },
  ],
  paragraph: {
    text: "At the heart of the city, this home keeps the noise outside. Mornings begin softly, evenings end slowly, and every day feels unhurried.",
    gist: "位在城市中心，把喧囂留在門外；早晨輕柔展開，傍晚緩緩落幕，每一天都從容不迫。",
    words: [
      { lemma: "heart", pos: "名詞", zh: "中心，核心" },
      { lemma: "city", pos: "名詞", zh: "城市，都市" },
      { lemma: "home", pos: "名詞", zh: "家，住所" },
      { lemma: "keep", pos: "動詞", zh: "使保持" },
      { lemma: "noise", pos: "名詞", zh: "噪音，喧鬧聲" },
      { lemma: "outside", pos: "副詞", zh: "在外面" },
      { lemma: "morning", pos: "名詞", zh: "早晨，上午" },
      { lemma: "begin", pos: "動詞", zh: "開始" },
      { lemma: "softly", pos: "副詞", zh: "輕柔地" },
      { lemma: "evening", pos: "名詞", zh: "傍晚，晚上" },
      { lemma: "end", pos: "動詞", zh: "結束" },
      { lemma: "slowly", pos: "副詞", zh: "緩慢地" },
      { lemma: "day", pos: "名詞", zh: "一天" },
      { lemma: "feel", pos: "動詞", zh: "感覺" },
      { lemma: "unhurried", pos: "形容詞", zh: "從容不迫的" },
    ],
  },
};

const els = {
  keyPanel: $("key-panel"), keySetup: $("key-setup"), keyReady: $("key-ready"), keyInput: $("f-key"),
  btnKeySave: $("btn-key-save"), btnKeyChange: $("btn-key-change"), btnKeyCancel: $("btn-key-cancel"),
  btnKeyDelete: $("btn-key-delete"), keyExtra: $("key-extra"), keyMsg: $("key-msg"), keyWait: $("key-wait"),
  keyTail: $("key-tail"), modelName: $("model-name"),
  usage: $("usage-n"), usageLine: $("usage-line"), limitDlg: $("limit-dlg"), limitCount: $("limit-count"),
  form: $("form"), title: $("f-title"), sub: $("f-sub"), other: $("f-other"), otherBox: $("c-other"),
  ticks: Array.from(document.querySelectorAll('input[name="ctx"]')),
  avoidTicks: Array.from(document.querySelectorAll('input[name="avoid"]')),
  avoidOther: $("f-avoid-other"), avoidOtherBox: $("c-avoid-other"),
  avoidFold: $("avoid-fold"), avoidPicked: $("avoid-picked"), avoidGroup: $("avoid"),
  btnGo: $("btn-go"), btnAgain: $("btn-again"), btnStop: $("btn-stop"), btnClear: $("btn-clear"),
  inputMsg: $("input-msg"), wait: $("wait"),
  msg: $("msg"), results: $("results"), body: $("result-body"), sr: $("sr"),
  history: $("history"), histList: $("hist-list"),
};

let apiKey = "";
let model = "";
let busy = false;
let ctl = null;
let waitTimer = null;
let waitStart = 0;
const TIME_LIMIT = 60; // 秒；超過就自動停止，免得一直轉

/* ---------- 小工具 ---------- */

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === "string" && v.trim() !== ""; }
function upper(s) { return s.toLocaleUpperCase("en-US"); }
function oneLine(v) { return String(v).replace(/\s+/g, " ").trim(); }
function isNarrow() { return window.matchMedia("(max-width: 1023px)").matches; } // 單欄（結果在表單下方）時，產生後要捲到結果
function reduceMotion() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }

function loadLS(k) { try { return localStorage.getItem(k) || ""; } catch (_) { return ""; } }
function saveLS(k, v) {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch (_) { /* 無痕視窗等情況存不了，這次開著的頁面仍可用 */ }
}

/* ---------- 今日用量：這個瀏覽器自己算，跟 Google 一樣在美國太平洋時間半夜換日 ---------- */
const LS_DAILY = "decoWords.daily.v1";
const DAILY_LIMIT = 500;
function pacificDay() {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()); }
  catch (_) { return new Date().toISOString().slice(0, 10); }
}
function readDaily() {
  const d = pacificDay();
  try {
    const o = JSON.parse(loadLS(LS_DAILY) || "null");
    if (o && o.d === d && Number.isFinite(o.n)) return { d, n: o.n, ok: !!o.ok };
  } catch (_) { /* 記錄壞掉就從 0 算 */ }
  return { d, n: 0, ok: false };
}
function writeDaily(o) { saveLS(LS_DAILY, JSON.stringify(o)); showUsage(); }
function countUse() { const o = readDaily(); o.n += 1; writeDaily(o); }
function showUsage() {
  const n = readDaily().n;
  els.usage.textContent = n + " 次（僅此瀏覽器的送出紀錄）";
  els.usageLine.classList.toggle("is-near", n >= DAILY_LIMIT - 50);
}
// 今天已送出 500 次：先跳視窗確認（有綁付款的金鑰繼續用會收費）；同一天按過「繼續產生」就不再問
function allowOverLimit() { return Promise.resolve(true); }

// 把單字轉成劍橋字典網址最後一段：小寫、去重音、空格換連字號
function headwordSlug(word) {
  const raw = nonEmpty(word.lemma) ? word.lemma : (nonEmpty(word.w) ? word.w : "");
  const s = raw
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9'-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-']+|[-']+$/g, "");
  return s || null;
}
function dictURL(slug) { return CAMBRIDGE + encodeURIComponent(slug); }

/* ---------- 驗證 ---------- */

function validWords(arr) {
  return Array.isArray(arr) && arr.every((x) => isObj(x) && (nonEmpty(x.lemma) || nonEmpty(x.w)) && nonEmpty(x.zh));
}

// 主標、副標的翻譯：要有非空的 text 和 words 陣列
function validTitleItem(x) {
  return isObj(x) && nonEmpty(x.text) && validWords(x.words);
}

// hasSub：這次使用者有沒有填副標；沒填時結果裡就算有 subhead 也忽略
function validateResult(obj, hasSub) {
  const fail = (why) => { validateResult.lastReason = why; return false; };
  validateResult.lastReason = "";
  if (!isObj(obj)) return fail("結果不是物件");
  if (!validTitleItem(obj.headline)) return fail("headline 缺 text 或 words 格式不對");
  if (hasSub && !validTitleItem(obj.subhead)) return fail("有填副標，但 subhead 缺 text 或 words 格式不對");
  if (!Array.isArray(obj.accents) || obj.accents.length < 3) return fail("accents 少於 3 組");
  for (const a of obj.accents.slice(0, 3)) {
    if (!isObj(a) || !nonEmpty(a.text) || !nonEmpty(a.zh)) return fail("accents 有項目缺 text/zh");
    if (!validWords(a.words)) return fail("accents 的 words 格式不對");
  }
  const p = obj.paragraph;
  if (!isObj(p) || !nonEmpty(p.text) || !nonEmpty(p.gist)) return fail("paragraph 缺 text 或 gist");
  if (!validWords(p.words)) return fail("paragraph 的 words 格式不對");
  if (obj.notes != null && (!Array.isArray(obj.notes) || !obj.notes.every((s) => typeof s === "string"))) return fail("notes 不是字串陣列");
  return true;
}
validateResult.lastReason = "";

function cleanWords(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const slug = headwordSlug(x);
    const shown = slug || oneLine(nonEmpty(x.lemma) ? x.lemma : x.w);
    if (seen.has(shown)) continue;
    seen.add(shown);
    out.push({ lemma: shown, slug, pos: nonEmpty(x.pos) ? oneLine(x.pos) : "", zh: oneLine(x.zh) });
  }
  return out;
}

// 純單字翻譯：只留真的一個字（模型偶爾會回片語或連字號），去掉結尾句點和重複，最多 2 個。
// 不合格的直接不顯示，不讓整次產生失敗；舊的歷史紀錄沒有這個欄位，回傳空陣列
function cleanOneWords(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (!isObj(x) || !nonEmpty(x.text) || !nonEmpty(x.zh)) continue;
    const t = oneLine(x.text).replace(/[.。]+$/, "");
    if (!/^\p{L}+$/u.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: t.charAt(0).toUpperCase() + t.slice(1), zh: oneLine(x.zh) });
    if (out.length === 2) break;
  }
  return out;
}

function normalizeTitleItem(x) {
  return { text: oneLine(x.text), oneWords: cleanOneWords(x.oneWords), words: cleanWords(x.words) };
}

// title、sub：使用者輸入的中文主標、副標（畫面上要顯示原文）；sub 是空字串就不輸出 subhead
function normalizeResult(obj, title, sub) {
  const r = {
    title,
    sub: sub || "",
    notes: (obj.notes || []).filter(nonEmpty).map(oneLine),
    headline: normalizeTitleItem(obj.headline),
    accents: obj.accents.slice(0, 3).map((a) => ({
      text: oneLine(a.text).replace(/[.。]+$/, ""),
      zh: oneLine(a.zh),
      words: cleanWords(a.words),
    })),
    paragraph: {
      text: oneLine(obj.paragraph.text),
      gist: oneLine(obj.paragraph.gist),
      words: cleanWords(obj.paragraph.words),
    },
  };
  if (sub) r.subhead = normalizeTitleItem(obj.subhead);
  return r;
}

/* ---------- Gemini ---------- */

class ApiError extends Error {
  constructor(kind, detail, status) {
    super(kind);
    this.kind = kind;
    this.detail = detail || "";
    this.status = status || 0;
  }
}

function classify(status, body) {
  const err = body && body.error ? body.error : {};
  const text = String(err.message || "");
  const reasons = Array.isArray(err.details) ? err.details.map((d) => d && d.reason).filter(Boolean) : [];
  if (status === 401 || reasons.includes("API_KEY_INVALID") || /api key (not valid|invalid|expired)/i.test(text)) return "bad_key";
  if (/location is not supported/i.test(text)) return "region";
  if (status === 403) return "denied";
  if (status === 404) return "no_model";
  if (status === 429) return "quota";
  if (status >= 500) return "busy";
  return "unknown";
}

async function gfetch(path, key, init) {
  let res;
  try {
    res = await fetch(API + path, {
      method: init && init.method ? init.method : "GET",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: init && init.body ? init.body : undefined,
      signal: init && init.signal ? init.signal : undefined,
      referrerPolicy: "no-referrer",
    });
  } catch (e) {
    if (e && e.name === "AbortError") throw new ApiError("cancelled");
    throw new ApiError("network", String(e && e.message ? e.message : e));
  }
  if (path.includes(":generateContent") && res.status !== 429) countUse();
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  if (!res.ok) {
    const detail = body && body.error && body.error.message ? body.error.message : "HTTP " + res.status;
    throw new ApiError(classify(res.status, body), detail, res.status);
  }
  return body;
}

function verParts(name) {
  const m = name.match(/^gemini-(\d+)(?:\.(\d+))?-/);
  return m ? [Number(m[1]), Number(m[2] || 0)] : [-1, -1];
}
function newestFirst(a, b) {
  const [a1, a2] = verParts(a);
  const [b1, b2] = verParts(b);
  return b1 - a1 || b2 - a2;
}

// 2026-10-30 用真金鑰實測：3.8-flash 26 秒～超過 60 秒；3.6-flash 4–6 秒但免費一天只有 20 次；
// 3.5-flash-lite 4.3 秒、免費一天 500 次 → 使用者選「全部改用輕量版」
const PREFERRED_MODEL = "gemini-3.5-flash-lite";

// 免費方案用輕量版：優先用實測過的那個，其次選版本最新的正式輕量版，再其次用 Google 的「最新輕量版」別名；
// 都沒有才退回一般 Flash
function pickModel(models) {
  const names = (Array.isArray(models) ? models : [])
    .filter((m) => m && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => String(m.name || "").replace(/^models\//, ""));
  if (names.includes(PREFERRED_MODEL)) return PREFERRED_MODEL;
  const lite = names.filter((n) => /^gemini-\d+(?:\.\d+)?-flash-lite$/.test(n)).sort(newestFirst);
  if (lite.length) return lite[0];
  if (names.includes(BACKUP_MODEL)) return BACKUP_MODEL;
  const stable = names.filter((n) => /^gemini-\d+(?:\.\d+)?-flash$/.test(n)).sort(newestFirst);
  if (stable.length) return stable[0];
  if (names.includes("gemini-flash-latest")) return "gemini-flash-latest";
  const other = names
    .filter((n) => /^gemini-\d+(?:\.\d+)?-flash(?!-lite)/.test(n) && !/(image|tts|audio|live|embed|thinking)/.test(n))
    .sort(newestFirst);
  return other.length ? other[0] : "";
}

async function findModel(key, signal) {
  const list = await gfetch("models?pageSize=1000", key, { signal });
  const picked = pickModel(list && list.models);
  if (!picked) throw new ApiError("no_model", "清單裡沒有 Flash 模型");
  return picked;
}

function readJSON(text) {
  try { return JSON.parse(text); } catch (_) { /* 往下試 */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch (_) { /* 往下試 */ } }
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a !== -1 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch (_) { /* 失敗 */ } }
  return null;
}

// 輸出格式設定：0＝JSON＋格式表，1＝只指定 JSON，2＝不指定
const LS_FORMAT = "decoWords.format";
const FORMAT_ERR = /schema|response_?mime|response_format|generation_?config|unknown name|invalid json payload/i;
let formatLevel = Math.min(2, Math.max(0, Math.floor(Number(loadLS(LS_FORMAT))) || 0));

function genConfig(level) {
  if (level === 0) return { responseMimeType: "application/json", responseSchema: SCHEMA };
  if (level === 1) return { responseMimeType: "application/json" };
  return null;
}

// Flash 模型預設會先「思考」一陣子才回答，很慢；請它幾乎不想（Gemini 3 以後才吃這個設定）。
// 模型不接受就退一級，最後乾脆不送；每個模型各記各的
const LS_THINK = "decoWords.think.v2";
const THINK_STEPS = ["MINIMAL", "LOW", ""];
let thinkStep = readThink();

function readThink() {
  try {
    const o = JSON.parse(loadLS(LS_THINK) || "{}");
    return o && typeof o === "object" ? o : {};
  } catch (_) { return {}; }
}
function thinkIndex(m) { return Math.min(THINK_STEPS.length - 1, Math.max(0, Math.floor(Number(thinkStep[m])) || 0)); }
function thinkBackoff(m) {
  thinkStep[m] = thinkIndex(m) + 1;
  saveLS(LS_THINK, JSON.stringify(thinkStep));
}

// 主要模型忙線或超過 FIRST_TRY 秒還沒好，就改用 Google 的「最新輕量版」別名再試一次
// （別名可能就指向主要模型本身，那就等於同一個模型重試一次；忙線多半是一時的）
const BACKUP_MODEL = "gemini-flash-lite-latest";
const FIRST_TRY = 20;

const BLOCKED = ["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "LANGUAGE", "IMAGE_SAFETY"];

async function callModel(m, input, signal) {
  for (;;) {
    const payload = {
      systemInstruction: { parts: [{ text: RULES }] },
      contents: [{ role: "user", parts: [{ text: input }] }],
    };
    const gc = genConfig(formatLevel) || {};
    const level = THINK_STEPS[thinkIndex(m)];
    if (level) gc.thinkingConfig = { thinkingLevel: level };
    if (Object.keys(gc).length) payload.generationConfig = gc;
    try {
      return await gfetch("models/" + encodeURIComponent(m) + ":generateContent", apiKey, {
        method: "POST",
        signal,
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // 模型不接受這個思考程度時，退一級再送一次
      if (e instanceof ApiError && e.status === 400 && e.kind === "unknown" && level && /thinking/i.test(e.detail)) {
        thinkBackoff(m);
        continue;
      }
      // Google 不接受輸出格式設定時，改用較簡單的設定再送一次（最多退兩級；規則文字本身已寫明 JSON 格式）
      if (e instanceof ApiError && e.status === 400 && e.kind === "unknown" && FORMAT_ERR.test(e.detail) && formatLevel < 2) {
        formatLevel += 1;
        saveLS(LS_FORMAT, String(formatLevel));
        continue;
      }
      throw e;
    }
  }
}

// 跟外層的停止鈕連動，另外加一個較短的時限；時限到了丟出 "slow"
async function withTimeLimit(outer, sec, run) {
  const c = new AbortController();
  let slow = false;
  const stop = () => c.abort();
  if (outer.aborted) c.abort();
  else outer.addEventListener("abort", stop);
  const t = setTimeout(() => { slow = true; c.abort(); }, sec * 1000);
  try {
    return await run(c.signal);
  } catch (e) {
    if (slow && !outer.aborted && e instanceof ApiError && e.kind === "cancelled") throw new ApiError("slow");
    throw e;
  } finally {
    clearTimeout(t);
    outer.removeEventListener("abort", stop);
  }
}

// 換一組要避開的單字：同一組主副標已經出現過的（右邊正在顯示的，加上歷史紀錄裡的）
function usedOneWords(title, sub) {
  const seen = new Map();
  for (const r of [shownResult].concat(readHistory().map((x) => x.r))) {
    if (!r || r.title !== title || (r.sub || "") !== sub) continue;
    const list = (r.headline.oneWords || []).concat((r.subhead && r.subhead.oneWords) || []);
    for (const w of list) seen.set(w.text.toLowerCase(), w.text);
  }
  return [...seen.values()];
}
function anotherSetHint(title, sub) {
  const base = "This is a request for another set: choose three different accents and write a differently worded paragraph. Keep the headline and subhead translations accurate; they may stay the same.";
  const used = usedOneWords(title, sub);
  if (!used.length) return base;
  return base + " Give new oneWords too. These words were already shown, so do not use any of them again, for the headline or the subhead: " + used.join(", ") + ". The new words must still cover what the source means.";
}

async function askGemini(title, sub, extra, avoid, fresh, signal) {
  if (!model) {
    model = await findModel(apiKey, signal);
    saveLS(LS_MODEL, model);
    showKeyState();
  }
  let input = "主標：" + title;
  if (sub) input += "\n副標：" + sub;
  if (extra) input += "\n補充說明：" + extra;
  if (avoid) input += "\n避免：" + avoid + "\n(Do not write about any of these in the accents or the paragraph.)";
  if (fresh) input += "\n\n" + anotherSetHint(title, sub);
  let data;
  try {
    data = await withTimeLimit(signal, FIRST_TRY, (s) => callModel(model, input, s));
  } catch (e) {
    const retry = e instanceof ApiError && (e.kind === "slow" || e.kind === "busy") && model !== BACKUP_MODEL;
    if (!retry) throw e instanceof ApiError && e.kind === "slow" ? new ApiError("busy") : e;
    try {
      data = await callModel(BACKUP_MODEL, input, signal);
    } catch (e2) {
      // 備用模型不存在時，照實說主要模型忙線
      if (e2 instanceof ApiError && e2.kind === "no_model") throw new ApiError("busy", e.detail);
      throw e2;
    }
  }
  const block = data && data.promptFeedback ? data.promptFeedback.blockReason : "";
  if (block && block !== "BLOCK_REASON_UNSPECIFIED") throw new ApiError("blocked", block);
  const cand = data && Array.isArray(data.candidates) ? data.candidates[0] : null;
  if (!cand) throw new ApiError("incomplete", "沒有回傳內容");
  const reason = cand.finishReason || "STOP";
  if (BLOCKED.includes(reason)) throw new ApiError("blocked", reason);
  if (reason !== "STOP" && reason !== "FINISH_REASON_UNSPECIFIED") throw new ApiError("incomplete", reason);
  const parts = cand.content && Array.isArray(cand.content.parts) ? cand.content.parts : [];
  const text = parts.filter((p) => p && typeof p.text === "string" && !p.thought).map((p) => p.text).join("");
  const obj = readJSON(text);
  if (!obj) throw new ApiError("incomplete", "回傳的不是 JSON");
  return obj;
}

const MESSAGES = {
  cancelled: { text: "已停止。", kind: "info" },
  timeout: { text: "Google 超過 60 秒沒有回應，已自動停止。請再按一次「產生」；一直這樣的話，可能是 Google 那邊壅塞，晚點再試。", kind: "error" },
  bad_key: { text: "金鑰不正確。請到 Google AI Studio 重新複製金鑰，按上方「更換金鑰」再貼一次。", kind: "error" },
  region: { text: "Google 表示目前所在的地區不能使用 Gemini API。", kind: "error" },
  denied: { text: "這組金鑰沒有使用 Gemini 的權限，請到 Google AI Studio 重新建立一組金鑰。", kind: "error" },
  no_model: { text: "找不到可以用的模型，請再按一次「產生」。", kind: "error" },
  quota: { text: "Google 回報用量限制。請稍後再試，或至 Google AI Studio 檢查專案額度。", kind: "error" },
  busy: { text: "Google 那邊忙線中，請過一會兒再按一次。", kind: "error" },
  network: { text: "連不上 Google，請確認網路後再試。", kind: "error" },
  blocked: { text: "Google 沒有處理這段內容，請調整標題後再試。", kind: "error" },
  incomplete: { text: "這次的結果不完整，請再按一次「產生」。", kind: "error" },
  unknown: { text: "出了點問題，請再按一次「產生」。", kind: "error" },
};

/* ---------- 金鑰 ---------- */

function showKeyState(editing) {
  const has = !!apiKey;
  const setup = editing || !has;
  els.keySetup.hidden = !setup;
  els.keyReady.hidden = setup;
  els.keyExtra.hidden = !(setup && has);
  els.keyPanel.classList.toggle("is-ready", !setup);
  els.keyTail.textContent = has ? apiKey.slice(-4) : "";
  els.modelName.textContent = model || "自動選擇";
  document.dispatchEvent(new Event("deco:key-state"));
}

function showKeyMsg(text) { els.keyMsg.textContent = text; els.keyMsg.hidden = false; }
function hideKeyMsg() { els.keyMsg.hidden = true; els.keyMsg.textContent = ""; }

async function saveKey() {
  const key = els.keyInput.value.trim();
  if (!key) { showKeyMsg("請先貼上金鑰。"); els.keyInput.focus(); return; }
  if (/\s/.test(key)) { showKeyMsg("金鑰中間不應該有空格或換行，請重新複製。"); return; }
  hideKeyMsg();
  els.btnKeySave.disabled = true;
  els.keyWait.hidden = false;
  try {
    const picked = await findModel(key);
    apiKey = key;
    model = picked;
    thinkStep = {};
    saveLS(LS_KEY, apiKey);
    saveLS(LS_MODEL, model);
    saveLS(LS_THINK, "");
    els.keyInput.value = "";
    showKeyState(false);
    els.sr.textContent = "金鑰已儲存";
    els.title.focus();
  } catch (e) {
    const kind = e instanceof ApiError ? e.kind : "unknown";
    const m = kind === "unknown" || kind === "no_model"
      ? "沒辦法確認這組金鑰，請再試一次。" + (e && e.detail ? "（Google 回應：" + e.detail + "）" : "")
      : MESSAGES[kind].text;
    showKeyMsg(m);
  } finally {
    els.btnKeySave.disabled = false;
    els.keyWait.hidden = true;
  }
}

els.btnKeySave.addEventListener("click", saveKey);
els.keyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); saveKey(); }
});
els.btnKeyChange.addEventListener("click", () => {
  hideKeyMsg();
  els.keyInput.value = "";
  showKeyState(true);
  els.keyInput.focus();
});
els.btnKeyCancel.addEventListener("click", () => {
  hideKeyMsg();
  els.keyInput.value = "";
  showKeyState(false);
});
els.btnKeyDelete.addEventListener("click", () => {
  apiKey = "";
  model = "";
  saveLS(LS_KEY, "");
  saveLS(LS_MODEL, "");
  els.keyInput.value = "";
  hideKeyMsg();
  showKeyState(false);
  els.sr.textContent = "已刪除金鑰";
});

/* ---------- 複製 ---------- */

const copyTimers = new WeakMap();

// 圓形複製鈕上的圖示（純外觀；內嵌 SVG，沒有外部檔案）
const SVG_ATTR = 'viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
const ICON_COPY = "<svg " + SVG_ATTR + '><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9"/></svg>';
// 大小寫小圖示：圓角方框＋字母，放在每行英文前面（大寫 A／小寫 a）
const ICON_UPPER = "<svg " + SVG_ATTR + '><rect x="3" y="3" width="18" height="18" rx="5"/><text x="12" y="16.4" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor" stroke="none">A</text></svg>';
const ICON_LOWER = "<svg " + SVG_ATTR + '><rect x="3" y="3" width="18" height="18" rx="5"/><text x="12" y="15.8" text-anchor="middle" font-size="13" font-weight="600" fill="currentColor" stroke="none">a</text></svg>';
const ICON_CHECK = "<svg " + SVG_ATTR + '><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const ICON_X = "<svg " + SVG_ATTR + '><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

function selectNode(node) {
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (_) { /* 選取失敗時按鈕仍會顯示提示 */ }
}

async function copyLine(btn, node) {
  const text = node.textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (_) {
    ok = false;
  }
  clearTimeout(copyTimers.get(btn));
  btn.classList.add("done");
  if (ok) {
    btn.innerHTML = ICON_CHECK;
    els.sr.textContent = "已複製";
  } else {
    selectNode(node);
    btn.dataset.hint = "已選取，請按 ⌘C";
    els.sr.textContent = "已選取，請按 ⌘C";
  }
  copyTimers.set(btn, setTimeout(() => {
    btn.innerHTML = ICON_COPY;
    delete btn.dataset.hint;
    btn.classList.remove("done");
  }, ok ? 1500 : 3000));
}

/* ---------- 渲染 ---------- */

function outRow(text, kind, aria) {
  const ico = h("span", { class: "case-ico", "aria-hidden": "true" });
  ico.innerHTML = kind.includes("upper") ? ICON_UPPER : ICON_LOWER;
  const t = h("p", { class: "out-text " + kind, lang: "en", text });
  const b = h("button", { class: "copy", type: "button", "aria-label": aria });
  b.innerHTML = ICON_COPY;
  b.addEventListener("click", () => { copyLine(b, t); });
  return h("div", { class: "out" }, ico, t, b);
}

function caseRow(name, text, kind, aria) {
  return h("div", { class: "case" }, h("span", { class: "case-name sr-only", text: name }), outRow(text, kind, aria));
}

// 2026-11-10 起結果分四格（他說太亂）：主標＋副標／單字／裝飾字／英文小段。
// 一格＝白底細框，最上面是這格的名稱（h3 灰底標籤），格內每筆之間一條細線
function group(title, ...kids) {
  return h("section", { class: "group", "aria-label": title }, h("h3", { class: "badge badge-soft", text: title }), ...kids.flat()); // h() 只攤平一層，傳進來的陣列要先攤開
}

// 主標／副標一筆：小字「主標」＋中文原文一行、全大寫、一般大小寫（各有複製鈕）
function titleItem(label, zh, item) {
  return h("article", { class: "card" },
    h("p", { class: "orig" }, h("span", { class: "orig-tag", text: label }), h("span", { class: "sr-only", text: "中文原文：" }), zh),
    caseRow("全大寫", upper(item.text), "upper", "複製" + label + "全大寫"),
    caseRow("一般大小寫", item.text, "normal", "複製" + label + "一般大小寫"));
}

// 單字、裝飾字、英文小段一筆：中文意思一行在上，下面全大寫、一般大小寫；who 用在複製鈕的語音說明
function smallItem(zhName, zh, text, who, kind) {
  const k = kind ? kind + " " : "";
  return h("article", { class: "card" },
    h("p", { class: "orig orig-sm" }, h("span", { class: "sr-only", text: zhName }), zh),
    caseRow("全大寫", upper(text), k + "upper", "複製" + who + "全大寫"),
    caseRow("一般大小寫", text, k + "normal", "複製" + who + "一般大小寫"));
}

function titlesGroup(r) {
  const hasSub = !!(r.sub && r.subhead);
  return group(hasSub ? "主標・副標" : "主標",
    titleItem("主標", r.title, r.headline),
    hasSub ? titleItem("副標", r.sub, r.subhead) : null);
}

// 主標、副標的純單字翻譯放同一格：每則一列（桌機兩個並排），舊歷史紀錄沒有單字就整格不顯示
function wordsGroup(r) {
  const rows = [["主標", r.headline]];
  if (r.sub && r.subhead) rows.push(["副標", r.subhead]);
  const kept = rows.filter(([, it]) => it && it.oneWords && it.oneWords.length);
  if (!kept.length) return null;
  return group("單字", kept.map(([label, it]) => h("div", { class: "word-row" },
    h("p", { class: "word-sub", text: label }),
    h("div", { class: "word-grid" }, it.oneWords.map((w, i) =>
      smallItem("中文意思：", w.zh, w.text, label + "第 " + (i + 1) + " 個單字"))))));
}

function accentsGroup(r) {
  return group("裝飾字", r.accents.map((a, i) => smallItem("中文意思：", a.zh, a.text, "第 " + (i + 1) + " 組裝飾字")));
}

// 英文小段與中文大意不放句號（模型偶爾仍會在結尾加，這裡收掉結尾那一個）
function noEndStop(t) { return t.replace(/[.。]+\s*$/, ""); }

function paragraphGroup(r) {
  return group("英文小段", smallItem("中文大意：", noEndStop(r.paragraph.gist), noEndStop(r.paragraph.text), "英文小段", "para"));
}

function render(r) {
  shownResult = r;
  els.body.replaceChildren();
  if (r.notes && r.notes.length) {
    els.body.append(h("aside", { class: "notes", "aria-label": "提示" }, r.notes.map((n) => h("p", { text: n }))));
  }
  els.body.append(titlesGroup(r));
  const words = wordsGroup(r);
  if (words) els.body.append(words);
  els.body.append(accentsGroup(r), paragraphGroup(r));
  els.body.scrollTop = 0; // 桌機的卡片清單在面板內捲動；重新產生後回到最上面
}

/* ---------- 訊息 ---------- */

function showMsg(text, kind, detail, prefix) {
  els.msg.replaceChildren(text);
  if (detail) els.msg.append(h("span", { class: "msg-detail", text: (prefix || "Google 回應：") + detail }));
  els.msg.dataset.kind = kind;
  els.msg.hidden = false;
  if (isNarrow()) els.msg.scrollIntoView({ block: "nearest", behavior: reduceMotion() ? "auto" : "smooth" });
}
function hideMsg() { els.msg.hidden = true; els.msg.replaceChildren(); }
function showInputMsg(text) { els.inputMsg.textContent = text; els.inputMsg.hidden = false; }
function hideInputMsg() { els.inputMsg.hidden = true; els.inputMsg.textContent = ""; }

/* ---------- 補充說明、避免（勾選項） ---------- */

// 勾「其他」才顯示自填欄；取消勾選就隱藏（隱藏時 pickedText 也不會送出它的內容）
function syncOther() {
  els.other.hidden = !els.otherBox.checked;
  els.avoidOther.hidden = !els.avoidOtherBox.checked;
}

// 避免收起來時也要看得到勾了什麼，不然會忘記它還在作用
function syncAvoidPicked() {
  els.avoidPicked.textContent = pickedText(els.avoidTicks, els.avoidOtherBox, els.avoidOther, true) || "選填";
}

// 組出「補充說明：」「避免：」後面的字：勾選項依畫面上固定的順序用頓號串起來（「其他」本身不列出），
// 有填自填欄就接「；其他：內容」。什麼都沒勾、也沒填就回傳空字串（呼叫端不加這一行）
// plain：自填內容直接當清單的一項，不加「其他：」。避免要用這個——寫成「其他：交通」模型會當成要寫交通
function pickedText(ticks, otherBox, otherInput, plain) {
  const picks = [];
  let other = false;
  for (const c of ticks) {
    if (!c.checked) continue;
    if (c === otherBox) other = true;
    else picks.push(c.value);
  }
  const parts = [];
  if (picks.length) parts.push(picks.join("、"));
  const o = other ? oneLine(otherInput.value) : "";
  if (o) parts.push(plain ? o : "其他：" + o);
  return parts.join(plain ? "、" : "；");
}

/* ---------- 歷史紀錄：最近 5 次產生的結果，只存在這個瀏覽器；點回去看不用再問 Google，不算用量 ---------- */

const LS_HISTORY = "decoWords.history.v1";
const HISTORY_MAX = 5;
let shownId = ""; // 右邊現在顯示的是哪一筆
let shownResult = null; // 右邊現在顯示的結果；無痕視窗存不了歷史紀錄時，換一組也知道要避開哪些單字

function validRecord(x) {
  if (!isObj(x) || !nonEmpty(x.id) || !isObj(x.input) || !isObj(x.r)) return false;
  const i = x.input;
  return nonEmpty(i.title) && Array.isArray(i.ctx) && Array.isArray(i.avoid) && validateResult(x.r, !!x.r.sub);
}
function readHistory() {
  try {
    const arr = JSON.parse(loadLS(LS_HISTORY) || "[]");
    if (Array.isArray(arr)) return arr.filter(validRecord).slice(0, HISTORY_MAX);
  } catch (_) { /* 記錄壞掉就當作沒有 */ }
  return [];
}
function writeHistory(list) {
  saveLS(LS_HISTORY, list.length ? JSON.stringify(list) : "");
  renderHistory();
}
function addHistory(input, r) {
  shownId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  writeHistory([{ id: shownId, input, r }].concat(readHistory()).slice(0, HISTORY_MAX));
}

// 這一刻的表單內容（存進歷史用）；fillForm 是反過來，把一筆歷史放回表單
function readForm() {
  const picked = (ticks) => ticks.filter((c) => c.checked).map((c) => c.value);
  return {
    title: oneLine(els.title.value),
    sub: oneLine(els.sub.value),
    ctx: picked(els.ticks),
    ctxOther: els.other.value,
    avoid: picked(els.avoidTicks),
    avoidOther: els.avoidOther.value,
  };
}
function fillForm(i) {
  els.title.value = i.title;
  els.sub.value = i.sub || "";
  els.other.value = i.ctxOther || "";
  els.avoidOther.value = i.avoidOther || "";
  for (const c of els.ticks) c.checked = i.ctx.includes(c.value);
  for (const c of els.avoidTicks) c.checked = i.avoid.includes(c.value);
  syncOther();
  syncAvoidPicked();
  els.title.dispatchEvent(new Event("input")); // 輸入框的 × 要跟著出現或消失
  els.sub.dispatchEvent(new Event("input"));
}

function openRecord(rec) {
  if (busy) return;
  fillForm(rec.input);
  hideInputMsg();
  hideMsg();
  render(rec.r);
  els.btnAgain.hidden = false;
  shownId = rec.id;
  markShown();
  els.sr.textContent = "已顯示歷史紀錄：" + rec.input.title;
}

// 刪掉一筆：右邊正在看的結果留著（和「清除」一樣不動結果），鍵盤焦點移到下一筆的 ×
function removeRecord(id, index) {
  if (shownId === id) shownId = "";
  writeHistory(readHistory().filter((x) => x.id !== id));
  const next = els.histList.children[Math.min(index, els.histList.children.length - 1)];
  (next ? next.querySelector(".hist-x") : els.body).focus({ preventScroll: true });
  els.sr.textContent = "已刪除這筆歷史紀錄";
}

function markShown() {
  for (const li of els.histList.children) {
    const on = li.dataset.id === shownId;
    li.classList.toggle("is-on", on);
    if (on) li.firstChild.setAttribute("aria-current", "true");
    else li.firstChild.removeAttribute("aria-current");
  }
}

function renderHistory() {
  const list = readHistory();
  els.history.hidden = !list.length;
  els.histList.replaceChildren(...list.map((rec, i) => {
    const { title, sub } = rec.input;
    const same = list.filter((x) => x.input.title === title);
    const no = same.length > 1 ? same.length - same.indexOf(rec) : 0; // 同一個主標有好幾筆（例如按過換一組）才編號，越新號碼越大
    const label = (sub ? title + "／" + sub : title) + (no ? " 第 " + no + " 筆" : "");
    const open = h("button", { class: "hist-open", type: "button", title: label, "aria-label": "查看 " + label, disabled: busy },
      h("span", { class: "hist-name", text: title }),
      no ? h("span", { class: "hist-no", text: String(no) }) : null);
    open.addEventListener("click", () => { openRecord(rec); });
    const x = h("button", { class: "hist-x", type: "button", "aria-label": "刪除 " + label });
    x.innerHTML = ICON_X;
    x.addEventListener("click", () => { removeRecord(rec.id, i); });
    return h("li", { class: "hist", "data-id": rec.id }, open, x);
  }));
  markShown();
}

/* ---------- 產生 ---------- */

function setBusy(b) {
  busy = b;
  els.btnGo.disabled = b;
  els.btnAgain.disabled = b;
  els.btnStop.hidden = !b;
  els.wait.hidden = !b;
  for (const btn of els.histList.querySelectorAll(".hist-open")) btn.disabled = b; // 產生中不能切換，不然表單和結果會對不上
}

function updateWait() {
  const s = Math.floor((Date.now() - waitStart) / 1000);
  els.wait.textContent = s < 20
    ? "產生中…（已等候 " + s + " 秒）"
    : "產生中…（已等候 " + s + " 秒，Google 比平常慢；" + TIME_LIMIT + " 秒還沒好會自動停止）";
}
function startWait() {
  waitStart = Date.now();
  updateWait();
  clearInterval(waitTimer);
  waitTimer = setInterval(updateWait, 1000);
}
function endWait() {
  clearInterval(waitTimer);
  waitTimer = null;
  els.wait.textContent = "";
}

async function runGenerate(fresh) {
  if (busy) return;
  const title = oneLine(els.title.value);
  const sub = oneLine(els.sub.value);
  const extra = pickedText(els.ticks, els.otherBox, els.other);
  const avoid = pickedText(els.avoidTicks, els.avoidOtherBox, els.avoidOther, true);
  const formNow = readForm(); // 產生途中使用者可能改欄位，歷史要記按下去那一刻的內容
  if (!apiKey) {
    showInputMsg("請先在「設定」中填入 Gemini 金鑰。");
    showKeyState(true);
    els.keyInput.focus();
    return;
  }
  if (!title) {
    showInputMsg("請先輸入主標。");
    els.title.focus();
    return;
  }
  if (!(await allowOverLimit())) return;
  hideInputMsg();
  hideMsg();

  const controller = new AbortController();
  ctl = controller;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIME_LIMIT * 1000);
  setBusy(true);
  startWait();
  try {
    const obj = await askGemini(title, sub, extra, avoid, fresh, controller.signal);
    if (!validateResult(obj, !!sub)) {
      console.warn("結果驗證失敗：", validateResult.lastReason);
      const m = MESSAGES.incomplete;
      showMsg(m.text, m.kind);
      return;
    }
    const result = normalizeResult(obj, title, sub);
    render(result, { example: false });
    addHistory(formNow, result);
    els.btnAgain.hidden = false;
    els.sr.textContent = "已產生結果";
    if (isNarrow()) els.results.scrollIntoView({ block: "start", behavior: reduceMotion() ? "auto" : "smooth" });
  } catch (e) {
    let kind = e instanceof ApiError ? e.kind : "unknown";
    if (kind === "cancelled" && timedOut) kind = "timeout";
    if (!(e instanceof ApiError)) console.error(e);
    if (kind === "no_model") { model = ""; saveLS(LS_MODEL, ""); showKeyState(); }
    const m = MESSAGES[kind] || MESSAGES.unknown;
    const showDetail = kind === "unknown" || kind === "denied" || kind === "no_model" || kind === "network";
    showMsg(m.text, m.kind, showDetail && e && e.detail ? e.detail : "", kind === "network" ? "連線細節：" : "");
  } finally {
    clearTimeout(timer);
    endWait();
    setBusy(false);
    ctl = null;
  }
}

els.btnGo.addEventListener("click", () => { runGenerate(false); });
els.btnAgain.addEventListener("click", () => { runGenerate(true); });
els.btnStop.addEventListener("click", () => { if (ctl) ctl.abort(); });
els.btnClear.addEventListener("click", () => {
  els.title.value = "";
  els.sub.value = "";
  els.other.value = "";
  els.avoidOther.value = "";
  for (const c of els.ticks) c.checked = false;
  for (const c of els.avoidTicks) c.checked = false;
  syncOther();
  syncAvoidPicked();
  els.avoidFold.open = false;
  hideInputMsg();
  els.title.focus();
});
els.otherBox.addEventListener("change", () => {
  syncOther();
  if (els.otherBox.checked) els.other.focus();
});
els.avoidOtherBox.addEventListener("change", () => {
  syncOther();
  syncAvoidPicked();
  if (els.avoidOtherBox.checked) els.avoidOther.focus();
});
els.avoidGroup.addEventListener("input", syncAvoidPicked);

/* ---------- 新增的純外觀小功能（不碰上面任何邏輯）：輸入框 × ---------- */

// 1) 主標、副標輸入框右側的 ×：有內容才顯示；按下清空該欄並把焦點放回去
function bindClearX(input, btn) {
  const sync = () => { btn.hidden = input.value === ""; };
  input.addEventListener("input", sync);
  btn.addEventListener("click", () => { input.value = ""; sync(); input.focus(); });
  els.btnClear.addEventListener("click", sync); // 「清除」鈕（上面的程式）清空欄位後也要同步
  sync();
}
bindClearX(els.title, $("x-title"));
bindClearX(els.sub, $("x-sub"));

/* ---------- 啟動 ---------- */

apiKey = loadLS(LS_KEY);
model = loadLS(LS_MODEL);
showKeyState(false);
showUsage();
syncOther();
syncAvoidPicked();
renderHistory();
