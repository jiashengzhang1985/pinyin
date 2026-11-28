// 第五关：加减乘除。
// 趣味：每道题是一只新怪兽，答对就开枪打它（竖式每填对一位打一枪），连对 3 题以上“暴击”；打倒的怪兽收进收集册。
// 知识：竖式一位一位算，进位的小 1、退位点都会动画出现并讲解；乘除法配口诀表，背会一句表点亮一颗星。
import { useCallback, useEffect, useRef, useState } from 'react';
import usePersistedState from '@/utils/usePersistedState';
import { speakOffline, stopSpeaking } from '@/utils/tts';
import {
  MathOp, MathSettings, Question, generate, hintFor, speechFor, askSpeech, tableSpeech, SpeechLang, OP_SIGN, placeName,
} from '@/utils/mathQuestions';
import BattleStage, { BattleHandle, MONSTERS, Monster, MAX_HP } from './BattleStage';
import './MathGame.less';

const OP_TABS: { op: MathOp; label: string; color: string }[] = [
  { op: 'add', label: '加法 +', color: '#22c55e' },
  { op: 'sub', label: '减法 −', color: '#3b82f6' },
  { op: 'mul', label: '乘法 ×', color: '#f59e0b' },
  { op: 'div', label: '除法 ÷', color: '#ec4899' },
];

// 答错时怪兽的嘲笑：气泡里显示，同时用所选语言读出来
const TAUNTS: Record<SpeechLang, string[]> = {
  zh: ['打偏了！'],
  en: ['Missed!'],
};
const pickTaunt = (lang: SpeechLang) => TAUNTS[lang][Math.floor(Math.random() * TAUNTS[lang].length)];

interface Float { id: number; text: string; cls: string }
let uid = 0;

interface Props {
  op: MathOp;
  onOpChange: (op: MathOp) => void;
  settings: MathSettings;
  speakOn: boolean;
  lang: SpeechLang; // 朗读用中文还是英文
  missShot: boolean; // 答错时子弹打偏（关掉就是怪兽直接邪笑）
}

export default function MathGame({ op, onOpChange, settings, speakOn, lang, missShot }: Props) {
  const [question, setQuestion] = useState<Question | null>(null);
  const [input, setInput] = useState('');       // 横式答案 / 商
  const [remInput, setRemInput] = useState(''); // 余数
  const [field, setField] = useState<'q' | 'r'>('q');
  const [col, setCol] = useState(0);            // 竖式：正在算第几位（0 = 个位）
  const [filled, setFilled] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);        // 这道题错了几次
  const [shake, setShake] = useState(0);
  const [explain, setExplain] = useState('');   // 讲解（答对后/答错后）
  const [solved, setSolved] = useState(false);

  // 打怪兽
  const [collection, setCollection] = usePersistedState<string[]>('level6.collection', []);
  const [monster, setMonster] = useState<Monster>(MONSTERS[0]);
  const [monsterKey, setMonsterKey] = useState(0);
  const hpLeft = useRef(MAX_HP);
  const stage = useRef<BattleHandle>(null);
  const [floats, setFloats] = useState<Float[]>([]);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);

  const retry = useRef<{ q: Question; wait: number }[]>([]); // 错题过几题再出
  const lastKey = useRef('');

  const collectionRef = useRef(collection);
  collectionRef.current = collection;

  const reciting = op === 'mul' && settings.mulMode === 'recite';

  const addFloat = useCallback((text: string, cls = '') => {
    const id = ++uid;
    setFloats(f => [...f, { id, text, cls }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 1800);
  }, []);

  /** 朗读，读完后返回（只用系统语音，不联网）；关了朗读就直接返回 */
  const say = useCallback((text: string): Promise<void> => {
    if (!speakOn) return Promise.resolve();
    stopSpeaking();
    return speakOffline(text, lang === 'en' ? 'en-US' : 'zh-CN', lang === 'en' ? 0.8 : 0.9).catch(() => {});
  }, [speakOn, lang]);
  const questionNo = useRef(0); // 每出一道新题加 1，用来判断等朗读期间有没有换过题

  const show = (q: Question) => {
    setQuestion(q);
    setInput('');
    setRemInput('');
    setField('q');
    setCol(0);
    setFilled([]);
    setWrong(0);
    setExplain('');
    setSolved(false);
    lastKey.current = q.key;
    questionNo.current++;
    // 每道题一只新怪兽，优先没收集过的
    setMonster(prev => {
      const rest = MONSTERS.filter(m => m.e !== prev.e);
      const fresh = rest.filter(m => !collectionRef.current.includes(m.e));
      const pool = fresh.length && Math.random() < 0.6 ? fresh : rest;
      return pool[Math.floor(Math.random() * pool.length)];
    });
    setMonsterKey(k => k + 1);
    hpLeft.current = MAX_HP;
  };

  const nextQuestion = useCallback(() => {
    // 练习：到时间的错题先出
    retry.current.forEach(r => r.wait--);
    const due = retry.current.findIndex(r => r.wait <= 0);
    if (due >= 0) {
      const [r] = retry.current.splice(due, 1);
      addFloat('🔁 刚才错的题又来啦', '');
      show(r.q);
      return;
    }
    let q = generate(op, settings);
    for (let i = 0; i < 5 && q.key === lastKey.current; i++) q = generate(op, settings);
    show(q);
  }, [op, settings]);

  // 换了运算或设置就重新出题
  const settingsKey = JSON.stringify(settings);
  useEffect(() => {
    retry.current = [];
    show(generate(op, settings));
  }, [op, settingsKey]);

  // ---------- 答对 / 答错 ----------
  // 开一枪：竖式每填对一位打一枪（按位数平分血量），横式一枪打倒
  const shoot = (q: Question, kill: boolean) => {
    const hits = q.vertical && q.steps ? q.steps.length : 1;
    const dmg = kill ? hpLeft.current : Math.round(MAX_HP / hits);
    hpLeft.current -= dmg;
    stage.current?.fire(dmg, combo >= 2, kill); // 这一题答对后连对 ≥ 3 就是暴击
    if (kill) setCollection(c => (c.includes(monster.e) ? c : [...c, monster.e]));
  };

  const finishQuestion = () => {
    const newCombo = combo + 1;
    setCombo(newCombo);
    setScore(s => s + 1);
    if (newCombo === 3) addFloat('🔥 连对 3 题，开启暴击！', 'big');
    else if (newCombo > 3 && newCombo % 5 === 0) addFloat(`🔥 连对 ${newCombo} 题！`, 'big');
  };

  const onCorrect = (q: Question) => {
    setSolved(true);
    shoot(q, true);
    finishQuestion();
    const spoken = say(speechFor(q, lang));
    if (!q.vertical) {
      if (q.op === 'mul') setExplain(`${q.a} × ${q.b} = ${q.answer}`);
      else if (q.op === 'div') setExplain(q.remainder === undefined ? `因为 ${q.b} × ${q.answer} = ${q.a}` : `${q.b} × ${q.answer} = ${q.b * q.answer}，还多 ${q.remainder}`);
    }
    // 等算式读完再出下一题；至少留够打倒怪兽的动画时间，最多等 8 秒防止语音卡住
    const no = questionNo.current;
    const minWait = new Promise(r => setTimeout(r, q.vertical ? 1500 : 1100));
    const maxWait = new Promise(r => setTimeout(r, 8000));
    Promise.all([Promise.race([spoken, maxWait]), minWait])
      .then(() => new Promise(r => setTimeout(r, 300)))
      .then(() => { if (questionNo.current === no) nextQuestion(); });
  };

  const onWrong = (q: Question, colHint?: string) => {
    const w = wrong + 1;
    setWrong(w);
    setShake(s => s + 1);
    setCombo(0);
    const taunt = pickTaunt(lang);
    stage.current?.taunt(taunt, missShot);
    setTimeout(() => say(taunt), missShot ? 350 : 0); // 子弹打偏落空后再嘲笑
    try { navigator.vibrate?.(60); } catch {}
    if (w === 1) {
      if (!retry.current.some(r => r.q.key === q.key)) retry.current.push({ q, wait: 3 });
    }
    if (colHint) setExplain(w >= 2 ? colHint : '再想想，看看提示');
    else setExplain(hintFor(q, w));
  };

  // ---------- 输入 ----------
  const typeDigit = (d: string) => {
    const q = question;
    if (!q || solved || reciting) return;
    if (q.vertical && q.steps) {
      const step = q.steps[col];
      if (Number(d) === step.digit) {
        const nf = [...filled, step.digit];
        setFilled(nf);
        setWrong(0);
        if (step.carryOut) addFloat(q.op === 'add' ? '满十进一！' : '借 1 当 10！', 'carry');
        setExplain(step.hint);
        if (col + 1 >= q.steps.length) onCorrect(q);
        else { shoot(q, false); setCol(col + 1); }
      } else {
        onWrong(q, step.hint);
      }
      return;
    }
    const ansLen = String(q.answer).length;
    if (q.remainder !== undefined && field === 'r') {
      const r = (remInput + d).slice(0, String(q.remainder).length);
      setRemInput(r);
      if (r.length >= String(q.remainder).length) check(q, input, r);
      return;
    }
    const v = (input + d).slice(0, Math.max(ansLen, 3));
    setInput(v);
    if (v.length >= ansLen) {
      if (q.remainder !== undefined) {
        if (Number(v) === q.answer) setField('r');
        else check(q, v, remInput);
      } else check(q, v, '');
    }
  };

  const check = (q: Question, qa: string, ra: string) => {
    const ok = Number(qa) === q.answer && (q.remainder === undefined || Number(ra) === q.remainder);
    if (ok) onCorrect(q);
    else {
      onWrong(q);
      setTimeout(() => { setInput(''); setRemInput(''); setField('q'); }, 450);
    }
  };

  const backspace = () => {
    if (!question || solved || question.vertical) return;
    if (field === 'r') {
      if (remInput) setRemInput(remInput.slice(0, -1));
      else { setField('q'); setInput(input.slice(0, -1)); }
    } else setInput(input.slice(0, -1));
  };

  const submit = () => {
    const q = question;
    if (!q || solved || q.vertical || !input) return;
    if (q.remainder !== undefined && field === 'q') { setField('r'); return; }
    check(q, input, remInput);
  };

  const readQuestion = () => {
    const q = question;
    if (!q) return;
    say(askSpeech(q, lang));
  };

  // 实体键盘
  const handlers = useRef({ typeDigit, backspace, submit });
  handlers.current = { typeDigit, backspace, submit };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.repeat || e.metaKey || e.ctrlKey) return;
      if (/^[0-9]$/.test(e.key)) handlers.current.typeDigit(e.key);
      else if (e.key === 'Backspace') { e.preventDefault(); handlers.current.backspace(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlers.current.submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tableOps = op === 'mul' || op === 'div';

  return (
    <div className="math-game">
      <div className="math-tabs">
        {OP_TABS.map(t => (
          <button
            key={t.op}
            className={op === t.op ? 'active' : ''}
            style={{ '--c': t.color } as React.CSSProperties}
            onClick={() => onOpChange(t.op)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reciting ? <ReciteBoard lang={lang} /> : (<>
      <BattleStage ref={stage} monster={monster} monsterKey={monsterKey} score={score} combo={combo} collected={collection.filter(e => MONSTERS.some(m => m.e === e)).length} />

      <div className="math-main">
        <div className="question-card">
          {floats.map(f => <div key={f.id} className={`tip-float ${f.cls}`}>{f.text}</div>)}
          {question && (
            <div key={question.key + shake} className={`question${shake && !solved && wrong ? ' shake' : ''}${solved ? ' solved' : ''}`}>
              {question.vertical && question.steps
                ? <Vertical q={question} col={col} filled={filled} solved={solved} />
                : <Horizontal q={question} input={input} remInput={remInput} field={field} solved={solved} />}
            </div>
          )}
          {question?.vertical && question.steps && !solved ? (
            <div className="explain">
              {wrong ? <div>{explain}</div> : (
                <>
                  {explain && <div className="prev">{explain}</div>}
                  <div>{question.steps[col]?.ask}</div>
                </>
              )}
            </div>
          ) : (
            <div className="explain">
              {explain}
            </div>
          )}
        </div>

        {tableOps && (
          <div className="koujue-panel">
            <div className="kj-head">
              <span>乘法口诀表</span>
            </div>
            <div className="kj-table">
              {Array.from({ length: 9 }, (_, r) => r + 1).map(row => (
                <div key={row} className="kj-row">
                  {Array.from({ length: row }, (_, i) => i + 1).map(i => {
                    const isCurrent = question && question.op !== 'add' && question.op !== 'sub'
                      && ((question.op === 'mul' && Math.min(question.a, question.b) === i && Math.max(question.a, question.b) === row)
                        // 除法高亮这一格等于告诉了商，答错两次或答对后才亮
                        || (question.op === 'div' && (solved || wrong >= 2) && Math.min(question.b, question.answer) === i && Math.max(question.b, question.answer) === row));
                    return (
                      <span key={i}
                        className={`kj-cell${isCurrent ? ' now' : ''}`}
                        onClick={() => say(tableSpeech(i, row, lang))}>
                        {i}×{row}={i * row}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <NumPad
        onDigit={typeDigit}
        onBack={backspace}
        onOk={submit}
        onRead={readQuestion}
        remainder={question?.remainder !== undefined}
        onRem={() => input && setField('r')}
        vertical={!!question?.vertical}
      />
      </>)}
    </div>
  );
}

// ---------- 背口诀：点读口诀表 ----------
// 不出题：点哪一格就读哪一格的口诀；点行首 ▶ 连读这一行
function ReciteBoard({ lang }: { lang: SpeechLang }) {
  const [cur, setCur] = useState<[number, number] | null>(null);
  const [rowPlaying, setRowPlaying] = useState(0);
  const token = useRef(0);

  useEffect(() => () => { token.current++; stopSpeaking(); }, []);

  const readCell = (i: number, row: number) => {
    token.current++;
    setRowPlaying(0);
    setCur([i, row]);
    stopSpeaking();
    speakOffline(tableSpeech(i, row, lang), lang === 'en' ? 'en-US' : 'zh-CN', 0.8).catch(() => {});
  };

  const readRow = async (row: number) => {
    const t = ++token.current;
    stopSpeaking();
    setRowPlaying(row);
    for (let i = 1; i <= row; i++) {
      if (token.current !== t) return;
      setCur([i, row]);
      await speakOffline(tableSpeech(i, row, lang), lang === 'en' ? 'en-US' : 'zh-CN', 0.8).catch(() => {});
      await new Promise(r => setTimeout(r, 250));
    }
    if (token.current === t) setRowPlaying(0);
  };

  return (
    <div className="recite-board">
      <div className="recite-show">
        {cur ? (
          <div key={cur.join('x')} className="recite-eq">
            {cur[0]} <span className="op">×</span> {cur[1]} <span className="op">=</span> <b>{cur[0] * cur[1]}</b>
          </div>
        ) : (
          <div className="recite-tip">点一点下面的格子听口诀，点 ▶ 读一整行</div>
        )}
      </div>
      <div className="recite-table">
        {Array.from({ length: 9 }, (_, r) => r + 1).map(row => (
          <div key={row} className="rt-row">
            <button className={`rt-play${rowPlaying === row ? ' playing' : ''}`} onClick={() => readRow(row)} aria-label={`读 ${row} 这一行`}>
              {rowPlaying === row ? '🔊' : '▶'}
            </button>
            {Array.from({ length: 9 }, (_, c) => c + 1).map(i => (
              i <= row ? (
                <button key={i}
                  className={`rt-cell${cur && cur[0] === i && cur[1] === row ? ' on' : ''}`}
                  onClick={() => readCell(i, row)}>
                  <span>{i}×{row}</span><span className="rt-res">={i * row}</span>
                </button>
              ) : <span key={i} className="rt-empty" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 横式 ----------
function Horizontal({ q, input, remInput, field, solved }: { q: Question; input: string; remInput: string; field: 'q' | 'r'; solved: boolean }) {
  const shown = solved ? String(q.answer) : input;
  return (
    <div className="horizontal">
      <span>{q.a}</span>
      <span className="op">{OP_SIGN[q.op]}</span>
      <span>{q.b}</span>
      <span className="op">=</span>
      <span className={`ans${field === 'q' && !solved ? ' cursor' : ''}${solved ? ' ok' : ''}`}>{shown || ' '}</span>
      {q.remainder !== undefined && (
        <>
          <span className="op dots">……</span>
          <span className={`ans rem${field === 'r' && !solved ? ' cursor' : ''}${solved ? ' ok' : ''}`}>
            {(solved ? String(q.remainder) : remInput) || ' '}
          </span>
        </>
      )}
    </div>
  );
}

// ---------- 竖式 ----------
function Vertical({ q, col, filled, solved }: { q: Question; col: number; filled: number[]; solved: boolean }) {
  const steps = q.steps!;
  const width = Math.max(String(q.a).length, String(q.b).length, steps.length);
  const cols = Array.from({ length: width }, (_, i) => width - 1 - i); // 从左到右的位（大 → 小）
  const digit = (n: number, i: number) => {
    const s = String(n);
    return i < s.length ? s[s.length - 1 - i] : '';
  };
  // 已经算完的位里，哪些产生了进位/退位（标在前一位上）
  const marks = new Set(steps.slice(0, filled.length).map((s, i) => (s.carryOut ? i + 1 : -1)));

  return (
    <div className="vertical" style={{ '--w': width + 1 } as React.CSSProperties}>
      {/* 被减数上方的退位点 */}
      <div className="v-row v-borrow">
        <span />
        {cols.map(i => <span key={i} className={col === i && !solved ? 'hl' : ''}>{q.op === 'sub' && marks.has(i) ? <i className="dot">•</i> : ''}</span>)}
      </div>
      <div className="v-row">
        <span />
        {cols.map(i => <span key={i} className={col === i && !solved ? 'hl' : ''}>{digit(q.a, i)}</span>)}
      </div>
      <div className="v-row">
        <span className="op">{OP_SIGN[q.op]}</span>
        {cols.map(i => <span key={i} className={col === i && !solved ? 'hl' : ''}>{digit(q.b, i)}</span>)}
      </div>
      {/* 加法进位的小 1 写在横线上方 */}
      <div className="v-row v-carry">
        <span />
        {cols.map(i => <span key={i} className={col === i && !solved ? 'hl' : ''}>{q.op === 'add' && marks.has(i) ? <i className="one">1</i> : ''}</span>)}
      </div>
      <div className="v-line" />
      <div className="v-row v-ans">
        <span />
        {cols.map(i => (
          <span key={i} className={`${col === i && !solved ? 'hl cursor' : ''}${i < steps.length ? ' box' : ''}`}>
            {i < filled.length ? <b className="pop">{filled[i]}</b> : ''}
          </span>
        ))}
      </div>
      <div className="v-row v-place">
        <span />
        {cols.map(i => <span key={i}>{placeName(i).slice(0, 1)}</span>)}
      </div>
    </div>
  );
}

// ---------- 数字键盘 ----------
function NumPad({ onDigit, onBack, onOk, onRead, remainder, onRem, vertical }: {
  onDigit: (d: string) => void; onBack: () => void; onOk: () => void; onRead: () => void;
  remainder: boolean; onRem: () => void; vertical: boolean;
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  const btn = (id: string, label: React.ReactNode, action: () => void, cls = '') => (
    <button
      key={id}
      className={`np-key ${cls}${pressed === id ? ' is-pressed' : ''}`}
      onPointerDown={e => { e.preventDefault(); setPressed(id); try { navigator.vibrate?.(10); } catch {} action(); }}
      onPointerUp={() => setPressed(null)}
      onPointerLeave={() => setPressed(null)}
      onPointerCancel={() => setPressed(null)}
    >
      {label}
    </button>
  );
  // 两排：每排 5 个数字 + 右边 2 个功能键（只剩一个功能键就占两格）
  type Fn = [string, React.ReactNode, () => void, string];
  const row1: Fn[] = [];
  const row2: Fn[] = [];
  if (!vertical) row1.push(['back', '⌫', onBack, 'fn']);
  row1.push(['read', '🔊', onRead, 'fn']);
  if (remainder) row2.push(['rem', '余', onRem, 'fn']);
  if (!vertical) row2.push(['ok', '✓', onOk, 'ok']);
  const fns = (keys: Fn[]) => keys.map(([id, label, act, cls]) => btn(id, label, act, `${cls}${keys.length === 1 ? ' wide' : ''}`));
  return (
    <div className="num-pad" onContextMenu={e => e.preventDefault()}>
      {['1', '2', '3', '4', '5'].map(d => btn(d, d, () => onDigit(d)))}
      {fns(row1)}
      {['6', '7', '8', '9', '0'].map(d => btn(d, d, () => onDigit(d)))}
      {fns(row2)}
    </div>
  );
}
