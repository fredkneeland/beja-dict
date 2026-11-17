/**
 * bejaScript.ts — switch Bidhaawyeet (Beja) words between Latin and Arabic script.
 *
 * Based on the convention in Wedekind, Wedekind & Abuzeinab Musa,
 * "Beja Pedagogical Grammar" (2004-2005), Table 1 and the Arabic-script
 * forms throughout that book. The letter tables live in bejaScriptMap.json.
 *
 *   latinToArabic("tubdhaawi")            -> "تُبڈاوے"
 *   latinToArabic("tubdhaawi", {marks: "plain"}) -> "تبڈاوے"
 *   arabicToLatin("تُبڈاوے")               -> "tubdhaawi"
 *   searchKey("dhiinaab") === searchKey("ذينااب") // fuzzy match across scripts
 *
 * No dependencies. Works in React Native, the browser and Node.
 * (Needs "resolveJsonModule": true in tsconfig, which Expo/RN templates already have.)
 */
import MAP from "./bejaScriptMap.json";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface LatinToArabicOptions {
  /**
   * "full"  (default) – short vowels, sukun, shadda, plus Wedekind's long-vowel
   *                     marks. This can be converted back to Latin without loss.
   * "plain"           – letters only, like everyday handwriting. Short vowels
   *                     are lost, so converting back is only approximate.
   */
  marks?: "full" | "plain";
  /**
   * How long ii / uu are marked after a consonant (only when marks = "full"):
   * "wedekind" (default) – kasratan / dammatan, as in the Pedagogical Grammar
   * "standard"           – ordinary kasra / damma, as in Arabic
   */
  longVowels?: "wedekind" | "standard";
  /** Convert ? , ; to ؟ ، ؛ (default true). */
  arabicPunctuation?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FATHA = "\u064e";
const KASRA = "\u0650";
const DAMMA = "\u064f";
const SUKUN = "\u0652";
const SHADDA = "\u0651";
const KASRATAN = "\u064d";
const DAMMATAN = "\u064c";
const HAMZA_ABOVE = "\u0654";
const HAMZA_BELOW = "\u0655";
const MADDA = "\u0653";
const ALL_MARKS = /[\u064b-\u0655\u0670]/g;

type VowelKey = "a" | "aa" | "i" | "ii" | "u" | "uu" | "ee" | "oo";
type Seat = "initial" | "afterHamza" | "medial" | "final";

const CONS: Record<string, string> = MAP.consonants;
const VOWELS = MAP.vowels as unknown as Record<VowelKey, Record<Seat, string>>;
const DIGRAPHS = ["dh", "th", "sh", "kh", "gh", "gw", "kw"];
const LATIN_LETTER = /[a-z']/;

// ---------------------------------------------------------------------------
// Latin -> Arabic
// ---------------------------------------------------------------------------

type Tok =
  | { t: "C"; v: string; gem: boolean }
  | { t: "V"; v: VowelKey }
  | { t: "Q" };

function tokenizeLatin(word: string): Tok[] {
  const w = word;
  const toks: Tok[] = [];
  let i = 0;
  while (i < w.length) {
    const ch = w[i];
    const two = w.slice(i, i + 2);
    // silent e: consonant + e + h  (deh, teh, seh, keh, geh ...)
    if (ch === "e" && w[i + 1] === "h" && i > 0 && "bdfgjklmnprstz".includes(w[i - 1])) {
      i += 1;
      continue;
    }
    if (DIGRAPHS.includes(two)) {
      pushCons(toks, two);
      i += 2;
      continue;
    }
    if (["aa", "ee", "ii", "oo", "uu"].includes(two)) {
      toks.push({ t: "V", v: two as VowelKey });
      i += 2;
      continue;
    }
    if (ch === "a" || ch === "i" || ch === "u") { toks.push({ t: "V", v: ch }); i++; continue; }
    if (ch === "e") { toks.push({ t: "V", v: "ee" }); i++; continue; } // loanword single e
    if (ch === "o") { toks.push({ t: "V", v: "oo" }); i++; continue; } // loanword single o
    if (ch === "'") { toks.push({ t: "Q" }); i++; continue; }
    if (CONS[ch]) { pushCons(toks, ch); i++; continue; }
    // c, q, x or anything unexpected: approximate
    const approx: Record<string, string> = { c: "k", q: "g", x: "k" };
    if (approx[ch]) { pushCons(toks, approx[ch]); i++; continue; }
    i++; // drop anything else inside a word
  }
  return toks;
}

function pushCons(toks: Tok[], v: string) {
  const prev = toks[toks.length - 1];
  if (prev && prev.t === "C" && prev.v === v && !prev.gem) prev.gem = true;
  else toks.push({ t: "C", v, gem: false });
}

function consonantArabic(v: string, gem: boolean): string {
  const base = CONS[v];
  if (!gem) return base;
  if (v === "gw" || v === "kw") return base + base; // the book writes doubled kw as كوكو (sikwkwart)
  return base + SHADDA;
}

function wordToArabic(word: string, opt: Required<LatinToArabicOptions>): string {
  const toks = tokenizeLatin(word);
  let out = "";
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    const prev = toks[k - 1];
    const isLast = k === toks.length - 1;
    if (tok.t === "C") {
      out += consonantArabic(tok.v, tok.gem);
      const next = toks[k + 1];
      const vowelNext = !!next && next.t === "V";
      // Sukun where a reader could otherwise misread the letter:
      //  - y / w with no vowel after them, unless they follow a or a long vowel (ay, aay, oow ...)
      //  - a word-final h, so that it is not read as the -a ending (ه)
      if ((tok.v === "y" || tok.v === "w") && !vowelNext && !tok.gem) {
        const pv = prev && prev.t === "V" ? prev.v : null;
        if (prev && (!pv || pv === "i" || pv === "u")) out += SUKUN;
      }
      if (tok.v === "h" && isLast && !tok.gem) out += SUKUN;
    } else if (tok.t === "Q") {
      const next = toks[k + 1];
      if (!next || next.t !== "V") out += MAP.hamza.beforeConsonantOrEnd;
      // otherwise the vowel writes its own hamza seat
    } else {
      let seat: Seat;
      if (!prev) seat = "initial";
      else if (prev.t === "Q" || prev.t === "V") seat = "afterHamza"; // vowel after vowel = implied glottal stop
      else seat = isLast ? "final" : "medial";
      let s = VOWELS[tok.v][seat];
      // final short a after a hamza: oond'a -> ۆندأه
      if (seat === "afterHamza" && tok.v === "a" && isLast) s = "\u0623\u0647";
      if (seat === "initial" && !prev && tok.v === "a" && isLast) s = "\u0623\u0647";
      if (opt.longVowels === "standard") s = s.replace(KASRATAN, KASRA).replace(DAMMATAN, DAMMA);
      out += s;
    }
  }
  if (opt.marks === "plain") out = out.replace(ALL_MARKS, "");
  return out;
}

/** Convert Latin-script Beja (Wedekind spelling) to Arabic script. Non-letters pass through. */
export function latinToArabic(text: string, options: LatinToArabicOptions = {}): string {
  const opt: Required<LatinToArabicOptions> = {
    marks: options.marks ?? "full",
    longVowels: options.longVowels ?? "wedekind",
    arabicPunctuation: options.arabicPunctuation ?? true,
  };
  const src = text.normalize("NFC").replace(/[\u2019\u02bc`\u0294]/g, "'").toLowerCase();
  let out = "";
  let i = 0;
  while (i < src.length) {
    if (LATIN_LETTER.test(src[i])) {
      let j = i;
      // a word = letters and apostrophes; '-' and '=' join morphemes inside a word
      while (j < src.length && (LATIN_LETTER.test(src[j]) || ((src[j] === "-" || src[j] === "=") && j + 1 < src.length && LATIN_LETTER.test(src[j + 1]) && j > i))) j++;
      const word = src.slice(i, j).replace(/[-=]/g, "");
      out += wordToArabic(word, opt);
      i = j;
    } else {
      const ch = src[i];
      out += opt.arabicPunctuation && (MAP.punctuation as Record<string, string>)[ch] ? (MAP.punctuation as Record<string, string>)[ch] : ch;
      i++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Arabic -> Latin
// ---------------------------------------------------------------------------

const AR_CONS: Record<string, string> = {
  "\u0628": "b", "\u062f": "d", "\u0688": "dh", "\u0641": "f", "\u0642": "g", "\u063a": "gh",
  "\u0647": "h", "\u062c": "j", "\u0643": "k", "\u062e": "kh", "\u0644": "l", "\u0645": "m",
  "\u0646": "n", "\u0631": "r", "\u0633": "s", "\u0634": "sh", "\u062a": "t", "\u0679": "th",
  "\u0632": "z", "\u067e": "p", "\u06a4": "v",
  // letters Beja readers may use from Arabic, mapped to the nearest Beja letter
  "\u0630": "dh", "\u0636": "d", "\u0637": "th", "\u0638": "dh", "\u062b": "s", "\u0635": "s",
  "\u062d": "h", "\u06a9": "k", "\u06af": "g", "\u0686": "sh",
};
const VOWEL_LETTERS = new Set(["\u0627", "\u0622", "\u0623", "\u0625", "\u06ce", "\u06c6", "\u06d2", "\u0626", "\u0624"]);
const HAMZA_SEATS = new Set(["\u0623", "\u0625", "\u0622", "\u0626", "\u0624", "\u0621"]);

interface Unit { base: string; marks: string }

function normalizeArabic(s: string): string {
  let t = s.replace(/[\ufb50-\ufdff\ufe70-\ufeff]/g, (c) => c.normalize("NFKC"));
  t = t.normalize("NFC");
  return t
    .replace(/\u0629/g, "\u0647") // ة -> ه
    .replace(/\u0649/g, "\u064a") // ى -> ي
    .replace(/\u06cc/g, "\u064a") // Persian yeh -> ي
    .replace(/\u0640/g, "");      // tatweel
}

function unitsOf(word: string): Unit[] {
  const units: Unit[] = [];
  for (const ch of word) {
    if (/[\u064b-\u0655\u0670]/.test(ch)) {
      if (units.length) units[units.length - 1].marks += ch;
      continue;
    }
    units.push({ base: ch, marks: "" });
  }
  // fold decomposed hamza / madda marks on alef into precomposed letters
  for (const u of units) {
    if (u.base === "\u0627") {
      if (u.marks.includes(MADDA)) u.base = "\u0622";
      else if (u.marks.includes(HAMZA_BELOW)) u.base = "\u0625";
      else if (u.marks.includes(HAMZA_ABOVE)) u.base = "\u0623";
    }
    u.marks = u.marks.replace(/[\u0653-\u0655]/g, "");
  }
  return units;
}

const has = (u: Unit | undefined, m: string) => !!u && u.marks.includes(m);
const shortOf = (u: Unit): string =>
  has(u, FATHA) ? "a" : has(u, KASRA) || has(u, KASRATAN) ? "i" : has(u, DAMMA) || has(u, DAMMATAN) ? "u" : "";

/** Does unit k start a vowel (so that a preceding ي/و must be a consonant y/w)? */
function startsVowel(units: Unit[], k: number): boolean {
  const u = units[k];
  if (!u) return false;
  // a hamza seat (أ إ آ ئ ؤ) begins with a glottal stop, i.e. a consonant
  if (HAMZA_SEATS.has(u.base)) return false;
  if (VOWEL_LETTERS.has(u.base)) return true;
  if (u.base === "\u0647" && k === units.length - 1 && !u.marks) return true; // final ه = -a
  return false;
}

function wordToLatin(word: string): string {
  const U = unitsOf(word);
  let out = "";
  let lastCons = ""; // Latin letters written for the previous unit, when it was a plain consonant
  const n = U.length;
  for (let k = 0; k < n; k++) {
    const prevCons = lastCons;
    lastCons = "";
    const u = U[k];
    const prev = U[k - 1];
    const next = U[k + 1];
    const initial = k === 0;
    const last = k === n - 1;
    const b = u.base;

    // --- hamza seats and alef ---------------------------------------------
    if (b === "\u0622") { out += initial ? "aa" : "'aa"; continue; }
    if (b === "\u0623" || b === "\u0625" || b === "\u0621") {
      const q = initial ? "" : "'";
      if (b === "\u0623" && next && next.base === "\u0647" && k + 1 === n - 1 && !next.marks) { out += q + "a"; k++; continue; }
      if (b === "\u0625") {
        if (next && next.base === "\u064a" && !has(u, FATHA) && !startsVowel(U, k + 2) && !(next.marks && shortOf(next))) { out += q + "ii"; k++; continue; }
        out += q + "i";
        continue;
      }
      const v = shortOf(u);
      if (v === "u" || (b === "\u0621" && next && next.base === "\u0648" && !v)) {
        if (next && next.base === "\u0648" && !shortOf(next) && !startsVowel(U, k + 2) && !has(next, SHADDA)) { out += q + "uu"; k++; continue; }
        out += q + "u";
        continue;
      }
      if (b === "\u0621") { out += "'" + v; continue; }
      out += q + (v === "i" ? "i" : "a");
      continue;
    }
    if (b === "\u0626" || b === "\u0624") { out += "'"; if (shortOf(u)) out += shortOf(u); continue; }
    if (b === "\u0627") {
      if (initial) { const v = shortOf(u); out += v || "a"; continue; }
      out += "aa";
      continue;
    }
    if (b === "\u06ce") { out += "ee"; continue; }
    if (b === "\u06c6") { out += "oo"; continue; }
    if (b === "\u06d2") { out += "i"; continue; }

    // --- ي : y or ii ---------------------------------------------------------
    if (b === "\u064a") {
      const p = prev ? prev.marks : "";
      const prevIsCons = !!prev && !VOWEL_LETTERS.has(prev.base) && (!(prev.base === "\u064a" || prev.base === "\u0648") || shortOf(prev) !== "" || has(prev, SHADDA));
      let long = false;
      if (initial) long = false;
      else if (p.includes(KASRATAN)) long = true;
      else if (!prevIsCons) long = false;
      else if (p.includes(FATHA) || p.includes(DAMMA) || p.includes(SUKUN)) long = false;
      else if (shortOf(u) || has(u, SUKUN) || startsVowel(U, k + 1) || has(u, SHADDA)) long = false;
      else long = true; // kasra or unmarked consonant + ي + consonant/end
      if (long) { out += out.endsWith("i") ? "i" : "ii"; continue; }
      out += "y" + (has(u, SHADDA) ? "y" : "") + shortOf(u);
      if (last && !shortOf(u)) { /* final y */ }
      continue;
    }

    // --- و : w or uu ---------------------------------------------------------
    if (b === "\u0648") {
      const p = prev ? prev.marks : "";
      const prevIsCons = !!prev && !VOWEL_LETTERS.has(prev.base) && (!(prev.base === "\u064a" || prev.base === "\u0648") || shortOf(prev) !== "" || has(prev, SHADDA));
      let long = false;
      if (initial) long = false;
      else if (p.includes(DAMMATAN)) long = true;
      else if (!prevIsCons) long = false;
      else if (p.includes(FATHA) || p.includes(KASRA) || p.includes(SUKUN)) long = false;
      else if (shortOf(u) || has(u, SUKUN) || startsVowel(U, k + 1) || has(u, SHADDA)) long = false;
      else long = true;
      if (long) { out += out.endsWith("u") ? "u" : "uu"; continue; }
      out += "w" + (has(u, SHADDA) ? "w" : "") + shortOf(u);
      continue;
    }

    // --- ه ---------------------------------------------------------------------
    if (b === "\u0647") {
      if (last && !u.marks && prev && !VOWEL_LETTERS.has(prev.base) && prev.base !== "\u064a" && prev.base !== "\u0648" && !prev.marks.replace(SHADDA, "")) {
        out += "a"; // final short a
        continue;
      }
      if (last && !u.marks && prev && (prev.base === "\u064a" || prev.base === "\u0648") && !prev.marks.replace(SHADDA, "") && /(y|w)$/.test(out)) {
        out += "a"; // ...ya / ...wa
        continue;
      }
      // keep d+h, t+h, s+h, k+h, g+h apart from the digraphs: deh, teh, seh, keh, geh
      if (/^(d|t|s|k|g)\1?$/.test(prevCons)) out += "e";
      out += "h" + (has(u, SHADDA) ? "h" : "") + shortOf(u);
      continue;
    }

    // --- other consonants ----------------------------------------------------
    const c = AR_CONS[b];
    if (c) {
      // ق / ك + و = gw / kw
      if ((c === "g" || c === "k") && next && next.base === "\u0648") {
        const sukunHere = has(u, SUKUN) || (has(u, SHADDA) && !shortOf(u));
        const afterW = U[k + 2];
        const wIsGlide = sukunHere || (!u.marks && (shortOf(next) !== "" || startsVowel(U, k + 2) || (afterW && afterW.base === "\u0627")));
        if (wIsGlide && !has(u, DAMMATAN) && !has(u, DAMMA)) {
          const dg = c + "w";
          out += has(u, SHADDA) ? dg + dg : dg;
          out += shortOf(next);
          k++;
          continue;
        }
      }
      out += has(u, SHADDA) ? c + c : c;
      lastCons = u.marks.replace(SHADDA, "") ? "" : has(u, SHADDA) ? c + c : c;
      // short vowel mark (long ii/uu marks are handled by the following ي/و)
      if (has(u, FATHA)) out += "a";
      else if (has(u, KASRA)) out += next && next.base === "\u064a" && !startsVowel(U, k + 2) && !shortOf(next) && !has(next, SUKUN) ? "" : "i";
      else if (has(u, DAMMA)) out += next && next.base === "\u0648" && !startsVowel(U, k + 2) && !shortOf(next) && !has(next, SUKUN) ? "" : "u";
      else if (has(u, KASRATAN) && !(next && next.base === "\u064a")) out += "ii";
      else if (has(u, DAMMATAN) && !(next && next.base === "\u0648")) out += "uu";
      continue;
    }

    out += b; // anything unknown passes through
  }
  return out;
}

/** Best-effort conversion of Arabic-script Beja back to Latin (Wedekind spelling).
 *  Exact for text produced by latinToArabic(…, {marks: "full"}); approximate for unvowelled text. */
export function arabicToLatin(text: string): string {
  const src = normalizeArabic(text);
  let out = "";
  let i = 0;
  const isAr = (c: string) => /[\u0621-\u064a\u064b-\u0655\u0670\u0679-\u06d3]/.test(c);
  while (i < src.length) {
    if (isAr(src[i])) {
      let j = i;
      while (j < src.length && isAr(src[j])) j++;
      out += wordToLatin(src.slice(i, j));
      i = j;
    } else {
      const ch = src[i];
      out += ch === "\u061f" ? "?" : ch === "\u060c" ? "," : ch === "\u061b" ? ";" : ch;
      i++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Search key — match a word typed in either script, with or without vowels
// ---------------------------------------------------------------------------

/**
 * Fold a Latin or Arabic word to a loose key for search. Two spellings of the
 * same word should give the same key even if one has no short vowels or uses
 * ordinary Arabic keyboard letters (ي for ێ, و for ۆ, د/ذ for ڈ, ت/ط for ٹ ...).
 * Store searchKey(headword) next to each entry and compare it with searchKey(query).
 */
export function searchKey(text: string): string {
  const ar = /[\u0600-\u06ff]/.test(text) ? normalizeArabic(text) : latinToArabic(text, { marks: "plain" });
  return ar
    .replace(ALL_MARKS, "")
    .replace(/[\u0623\u0625\u0622\u0671]/g, "\u0627") // أ إ آ -> ا
    .replace(/[\u0621\u0624\u0626\u0639]/g, "")       // ء ؤ ئ ع -> (dropped)
    .replace(/[\u06ce\u06d2\u0649\u06cc]/g, "\u064a") // ێ ے ى ی -> ي
    .replace(/\u06c6/g, "\u0648")                      // ۆ -> و
    .replace(/[\u0688\u0630\u0638\u0636]/g, "\u062f") // ڈ ذ ظ ض -> د
    .replace(/[\u0679\u0637]/g, "\u062a")              // ٹ ط -> ت
    .replace(/[\u062b\u0635]/g, "\u0633")              // ث ص -> س
    .replace(/[\u062d\u0629]/g, "\u0647")              // ح ة -> ه
    .replace(/[\u06a9]/g, "\u0643")
    .replace(/[\u06af\u063a]/g, "\u0642")              // گ غ -> ق
    .replace(/[^\u0621-\u064a\s]/g, "")
    .trim();
}
