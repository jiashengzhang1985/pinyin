// 第五关（加减乘除）的出题、竖式步骤和口诀

export type MathOp = 'add' | 'sub' | 'mul' | 'div';
export type CarryMode = 'any' | 'must' | 'none'; // 进位/退位：随机、必有、不要
export type MulMode = 'recite' | 'practice';      // 背口诀（点读口诀表）/ 练习
export type DivMode = 'exact' | 'remainder';      // 表内除法 / 有余数除法
export type SpeechLang = 'zh' | 'en';             // 朗读算式用中文还是英文

export interface MathSettings {
  addRange: number;
  addCarry: CarryMode;
  subRange: number;
  subBorrow: CarryMode;
  mulMode: MulMode;
  mulTables: number[];  // 练习：在哪几句表里出题
  divMode: DivMode;
  divTables: number[];
}

export const DEFAULT_SETTINGS: MathSettings = {
  addRange: 100,
  addCarry: 'any',
  subRange: 100,
  subBorrow: 'any',
  mulMode: 'recite',
  mulTables: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  divMode: 'exact',
  divTables: [1, 2, 3, 4, 5, 6, 7, 8, 9],
};

/** 竖式中某一位（从个位起）的计算步骤 */
export interface ColumnStep {
  digit: number;     // 这一位要写的数字
  carryOut: boolean; // 加法：向前一位进 1；减法：向前一位借 1
  hint: string;      // 讲解这一位怎么算（答对后或答错时显示）
  ask: string;       // 答题前的引导，不含答案
}

export interface Question {
  key: string;
  op: MathOp;
  a: number;
  b: number;
  answer: number;
  remainder?: number;   // 有余数除法
  vertical: boolean;    // 是否用竖式
  steps?: ColumnStep[]; // 竖式每一位的步骤（个位在前）
  koujue?: string;      // 乘除法相关的口诀
}

const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
export const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const digitsOf = (n: number) => [...String(n)].reverse().map(Number); // 个位在前
const PLACE = ['个位', '十位', '百位', '千位', '万位'];
export const placeName = (i: number) => PLACE[i] ?? `第${i + 1}位`;

// ---------- 口诀 ----------
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 口诀，例如 koujue(3, 7) = “三七二十一”，koujue(2, 5) = “二五一十” */
export const koujue = (x: number, y: number) => {
  const [a, b] = x <= y ? [x, y] : [y, x];
  const p = a * b;
  let prod: string;
  if (p < 10) prod = '得' + CN[p];
  else if (p === 10) prod = '一十';
  else {
    const t = Math.floor(p / 10), o = p % 10;
    prod = (t === 1 ? '' : CN[t]) + '十' + (o ? CN[o] : '');
  }
  return CN[a] + CN[b] + prod;
};

// ---------- 竖式步骤 ----------
export const addSteps = (a: number, b: number): ColumnStep[] => {
  const da = digitsOf(a), db = digitsOf(b);
  const len = String(a + b).length;
  const steps: ColumnStep[] = [];
  let carry = 0;
  for (let i = 0; i < len; i++) {
    const x = da[i] ?? 0, y = db[i] ?? 0;
    const s = x + y + carry;
    const place = placeName(i);
    let hint: string;
    if (i >= da.length && i >= db.length) hint = `${place}：只有进上来的 1，直接写 1`;
    else {
      const expr = carry ? `${x} + ${y} + 进位1 = ${s}` : `${x} + ${y} = ${s}`;
      hint = s >= 10 ? `${place}：${expr}，满十进一，写 ${s % 10} 进 1` : `${place}：${expr}`;
    }
    const ask = i >= da.length && i >= db.length
      ? `${place}：上面进上来一个 1，写几？`
      : `${place}：${x} + ${y}${carry ? ' + 进位1' : ''} = ?`;
    steps.push({ digit: s % 10, carryOut: s >= 10, hint, ask });
    carry = s >= 10 ? 1 : 0;
  }
  return steps;
};

export const subSteps = (a: number, b: number): ColumnStep[] => {
  const da = digitsOf(a), db = digitsOf(b);
  const len = String(a - b).length;
  const steps: ColumnStep[] = [];
  let borrow = 0;
  for (let i = 0; i < len; i++) {
    const x = da[i] ?? 0, y = db[i] ?? 0;
    const top = x - borrow;
    const place = placeName(i);
    const lead = borrow ? `被借走 1，${x} - 1 = ${top}；` : '';
    let hint: string, d: number, out = false;
    if (top < y) {
      d = top + 10 - y;
      out = true;
      hint = `${place}：${lead}${top} 不够减 ${y}，向前一位借 1 当 10，${top + 10} - ${y} = ${d}`;
    } else {
      d = top - y;
      hint = `${place}：${lead}${top} - ${y} = ${d}`;
    }
    const ask = `${place}：${borrow ? `${x} 被借走了 1，还剩 ${top}，` : ''}${top} - ${y} = ?${top < y ? '（不够减怎么办？）' : ''}`;
    steps.push({ digit: d, carryOut: out, hint, ask });
    borrow = out ? 1 : 0;
  }
  return steps;
};

const hasCarry = (a: number, b: number) => addSteps(a, b).some(s => s.carryOut);
const hasBorrow = (a: number, b: number) => subSteps(a, b).some(s => s.carryOut);

const fits = (mode: CarryMode, has: boolean) => mode === 'any' || (mode === 'must') === has;

// ---------- 出题 ----------
const genAdd = (range: number, mode: CarryMode): Question => {
  let a = 1, b = 1;
  for (let t = 0; t < 300; t++) {
    if (range <= 20) {
      a = rand(1, range - 1);
      b = rand(1, range - a);
    } else {
      // 大范围时让两个数都别太小，至少一个接近范围的量级
      const lo = range >= 1000 ? 10 : 5;
      a = rand(Math.max(lo, Math.floor(range / 10)), range - lo);
      b = rand(lo, range - a);
      if (Math.random() < 0.5) [a, b] = [b, a];
    }
    if (fits(mode, hasCarry(a, b))) break;
  }
  return makeAdd(a, b, range > 20);
};

const makeAdd = (a: number, b: number, vertical: boolean): Question => ({
  key: `add:${a}:${b}`,
  op: 'add', a, b, answer: a + b, vertical,
  steps: vertical ? addSteps(a, b) : undefined,
});

const genSub = (range: number, mode: CarryMode): Question => {
  let a = 2, b = 1;
  for (let t = 0; t < 300; t++) {
    if (range <= 20) {
      a = rand(2, range);
      b = rand(1, a - 1);
    } else {
      a = rand(Math.max(11, Math.floor(range / 10)), range);
      b = rand(Math.max(2, Math.floor(a / 20)), a - 1);
      // 竖式里差的位数和被减数一样，避免 583 - 579 = 4 这种前面全是 0 的题
      if (String(a - b).length < String(a).length) continue;
    }
    if (fits(mode, hasBorrow(a, b))) break;
  }
  return makeSub(a, b, range > 20);
};

const makeSub = (a: number, b: number, vertical: boolean): Question => ({
  key: `sub:${a}:${b}`,
  op: 'sub', a, b, answer: a - b, vertical,
  steps: vertical ? subSteps(a, b) : undefined,
});

export const makeMul = (a: number, b: number): Question => ({
  key: `mul:${a}:${b}`,
  op: 'mul', a, b, answer: a * b, vertical: false,
  koujue: koujue(a, b),
});

const genMul = (tables: number[]): Question => {
  const t = pick(tables.length ? tables : [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const o = rand(1, 9);
  return Math.random() < 0.5 ? makeMul(t, o) : makeMul(o, t);
};

const genDiv = (tables: number[], mode: DivMode): Question => {
  const pool = (tables.length ? tables : [1, 2, 3, 4, 5, 6, 7, 8, 9]).filter(d => mode === 'exact' || d >= 2);
  const d = pick(pool.length ? pool : [2, 3, 4, 5, 6, 7, 8, 9]);
  const q = rand(1, 9);
  if (mode === 'exact') {
    const c = d * q;
    return {
      key: `div:${c}:${d}`, op: 'div', a: c, b: d, answer: q, vertical: false,
      koujue: koujue(d, q),
    };
  }
  const r = rand(1, d - 1);
  const c = d * q + r;
  return {
    key: `div:${c}:${d}`, op: 'div', a: c, b: d, answer: q, remainder: r, vertical: false,
    koujue: koujue(d, q),
  };
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export const generate = (op: MathOp, s: MathSettings): Question => {
  switch (op) {
    case 'add': return genAdd(s.addRange, s.addCarry);
    case 'sub': return genSub(s.subRange, s.subBorrow);
    case 'mul': return genMul(s.mulTables);
    case 'div': return genDiv(s.divTables, s.divMode);
  }
};

export const OP_SIGN: Record<MathOp, string> = { add: '+', sub: '−', mul: '×', div: '÷' };

/** 答错后逐步加深的提示（横式题） */
export const hintFor = (q: Question, level: number): string => {
  if (q.op === 'mul') {
    const [x, y] = q.a <= q.b ? [q.a, q.b] : [q.b, q.a];
    return level >= 2 ? `${q.a} × ${q.b} = ${q.answer}` : `想一想：${x} × ${y}，看看口诀表第 ${y} 行`;
  }
  if (q.op === 'div') {
    if (q.remainder === undefined) {
      return level >= 2 ? `${q.b} × ${q.answer} = ${q.a}，所以 ${q.a} ÷ ${q.b} = ${q.answer}` : `想一想：${q.b} × ? = ${q.a}`;
    }
    const p = q.b * q.answer;
    return level >= 2
      ? `${q.b} × ${q.answer} = ${p}，${q.a} - ${p} = ${q.remainder}，商 ${q.answer} 余 ${q.remainder}`
      : `想一想：${q.b} 乘几最接近 ${q.a}，又不超过 ${q.a}？余数要比 ${q.b} 小`;
  }
  // 20 以内加减：凑十 / 破十
  if (q.op === 'add') {
    const big = Math.max(q.a, q.b), small = Math.min(q.a, q.b);
    if (big < 10 && big + small > 10 && level >= 1) {
      const need = 10 - big;
      return `凑十法：把 ${small} 分成 ${need} 和 ${small - need}，${big} + ${need} = 10，10 + ${small - need} = ${q.answer}`;
    }
    return `数一数：从 ${big} 往后数 ${small} 个`;
  }
  if (q.a > 10 && q.a < 20 && q.a % 10 < q.b && q.b < 10) {
    return `破十法：${q.a} 分成 10 和 ${q.a - 10}，10 - ${q.b} = ${10 - q.b}，${10 - q.b} + ${q.a - 10} = ${q.answer}`;
  }
  return `想一想：${q.b} + ? = ${q.a}`;
};

// ---------- 朗读（中文 / 英文） ----------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 英文数字，例如 1209 → “one thousand two hundred nine” */
export const enNumber = (n: number): string => {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + enNumber(n % 100) : '');
  return enNumber(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + enNumber(n % 1000) : '');
};

const ZH_OP: Record<MathOp, string> = { add: '加', sub: '减', mul: '乘', div: '除以' };
const EN_OP: Record<MathOp, string> = { add: 'plus', sub: 'minus', mul: 'times', div: 'divided by' };

/** 答对后朗读的算式：中文“1加2等于3”，英文“one plus two equals three” */
export const speechFor = (q: Question, lang: SpeechLang) => {
  if (lang === 'en') {
    const base = `${enNumber(q.a)} ${EN_OP[q.op]} ${enNumber(q.b)} equals ${enNumber(q.answer)}`;
    return q.remainder !== undefined ? `${base}, remainder ${enNumber(q.remainder)}` : base;
  }
  const base = `${q.a}${ZH_OP[q.op]}${q.b}等于${q.answer}`;
  if (q.remainder !== undefined) return `${base}余${q.remainder}`;
  return q.op === 'mul' ? `${base}，${q.koujue}` : base;
};

/** 读题：“1加2等于几？” / “What is one plus two?” */
export const askSpeech = (q: Question, lang: SpeechLang) =>
  lang === 'en'
    ? `What is ${enNumber(q.a)} ${EN_OP[q.op]} ${enNumber(q.b)}?`
    : `${q.a}${ZH_OP[q.op]}${q.b}等于几？`;

/** 口诀表点读：中文读口诀“七八五十六”，英文读 “seven times eight equals fifty-six” */
export const tableSpeech = (i: number, j: number, lang: SpeechLang) =>
  lang === 'en' ? `${enNumber(i)} times ${enNumber(j)} equals ${enNumber(i * j)}` : koujue(i, j);
