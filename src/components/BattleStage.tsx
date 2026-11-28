// 第五关的战场：左边射手开枪，右边怪兽挨打。
// 每道题一只新怪兽（monsterKey 变化即换新怪兽），满血 100；
// fire() 发一颗子弹，打中后扣血、冒火花、飘伤害数字；kill 时怪兽爆炸消失。
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './BattleStage.less';

// 小怪兽、妖怪、卡通幽灵和僵尸都可以
export const MONSTERS = [
  { e: '👾', n: '小怪兽' }, { e: '👹', n: '红面妖怪' }, { e: '👺', n: '长鼻妖怪' }, { e: '👽', n: '外星人' },
  { e: '🐲', n: '小火龙' }, { e: '🐉', n: '大青龙' }, { e: '🦖', n: '霸王龙' }, { e: '🦕', n: '长颈龙' },
  { e: '🐙', n: '章鱼怪' }, { e: '🦑', n: '大鱿鱼' }, { e: '🤖', n: '机器人' }, { e: '🎃', n: '南瓜怪' },
  { e: '🦂', n: '大蝎子' }, { e: '🕷️', n: '大蜘蛛' }, { e: '🐍', n: '大蟒蛇' }, { e: '🐊', n: '鳄鱼王' },
  { e: '🦈', n: '大鲨鱼' }, { e: '🦍', n: '大猩猩' }, { e: '🦀', n: '大螃蟹' }, { e: '🦞', n: '大龙虾' },
  { e: '👻', n: '小幽灵' }, { e: '🧟', n: '僵尸' },
];
export type Monster = (typeof MONSTERS)[number];

export const MAX_HP = 100;

/** 侧身朝右瞄准的士兵，端着 M4 突击步枪（枪口在 viewBox 的 (153, 45)） */
const Soldier = () => (
  <svg className="soldier" viewBox="0 0 160 130" aria-hidden>
    {/* 腿：后腿蹬直，前腿弓步 */}
    <path d="M52 84 L44 104 L40 124" stroke="#4b5320" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M62 84 L76 102 L78 124" stroke="#556b2f" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M32 120 h16 a4 4 0 0 1 4 4 v4 h-22 z" fill="#2b2118" />
    <path d="M72 120 h14 a5 5 0 0 1 5 5 v3 h-20 z" fill="#2b2118" />
    {/* 身体 + 战术背心 */}
    <path d="M46 50 Q48 44 58 44 L66 46 Q72 50 70 62 L68 88 L46 88 Q42 70 46 50 z" fill="#556b2f" />
    <path d="M48 54 L68 54 L67 84 L47 84 z" fill="#8b7d5a" />
    <rect x="50" y="60" width="7" height="9" rx="1.5" fill="#6f6446" />
    <rect x="59" y="60" width="7" height="9" rx="1.5" fill="#6f6446" />
    <rect x="46" y="84" width="24" height="5" fill="#3d3a2a" />
    {/* 后手（扣扳机的手） */}
    <path d="M54 54 Q60 64 74 60" stroke="#4b5320" strokeWidth="9" fill="none" strokeLinecap="round" />
    {/* 步枪 M4 */}
    <g>
      <path d="M44 41 L64 40 L64 51 L48 56 Q44 56 44 52 z" fill="#2a2a2a" />
      <rect x="40" y="40" width="5" height="16" rx="1.5" fill="#1a1a1a" />
      <rect x="63" y="38" width="36" height="13" rx="2" fill="#333" />
      <rect x="68" y="31" width="22" height="7" rx="2" fill="#1f1f1f" />
      <circle cx="88" cy="34.5" r="2.4" fill="#4fc3f7" opacity="0.8" />
      <path d="M73 51 L70 63 Q70 65 72 65 L77 65 L80 51 z" fill="#222" />
      <path d="M84 51 Q83 60 86 69 L94 67 Q91 59 92 51 z" fill="#2d2d2d" />
      <rect x="99" y="39.5" width="32" height="10" rx="2" fill="#3b3b3b" />
      <path d="M103 42 h24 M103 47 h24" stroke="#555" strokeWidth="1.2" />
      <rect x="124" y="33" width="3" height="7" fill="#222" />
      <rect x="131" y="42.5" width="17" height="4" fill="#1d1d1d" />
      <rect x="147" y="41.5" width="7" height="6" rx="1" fill="#111" />
    </g>
    {/* 前手托着护木 */}
    <path d="M58 50 Q80 60 106 52" stroke="#556b2f" strokeWidth="8" fill="none" strokeLinecap="round" />
    <circle cx="107" cy="51" r="4.5" fill="#d9a066" />
    <circle cx="75" cy="60" r="4.5" fill="#d9a066" />
    {/* 头：侧脸贴着枪托瞄准 */}
    <path d="M52 22 Q62 16 70 22 L72 28 L76 31 L72 33 L71 38 Q66 44 58 42 Q50 38 52 22 z" fill="#e8b98a" />
    <circle cx="66" cy="28" r="1.8" fill="#222" />
    <path d="M62 26 h7" stroke="#222" strokeWidth="1.2" />
    {/* 头盔 */}
    <path d="M47 25 Q48 9 63 9 Q76 10 75 23 L50 27 z" fill="#556b2f" />
    <path d="M46 25 L77 22 L77 25 L47 28 z" fill="#3e4a22" />
    <rect x="66" y="13" width="7" height="5" rx="1.5" fill="#2a2a2a" />
    <path d="M53 27 Q54 38 60 40" stroke="#2a2a2a" strokeWidth="1.5" fill="none" />
  </svg>
);

export interface BattleHandle {
  fire: (dmg: number, crit: boolean, kill: boolean) => void;
  taunt: (text: string, missShot: boolean) => void;
}

interface Spark { id: number; dx: number; dy: number; c: string; s: number }
interface Float { id: number; text: string; cls: string }
type MissKind = 'sky' | 'ground' | 'wide';
interface Shot {
  id: number; dmg: number; crit: boolean; kill: boolean;
  x: number; y: number; dx: number; dy: number;
  miss?: MissKind; taunt?: string; // 答错：子弹打偏，落空后怪兽邪笑
}
interface MissMark { id: number; x: number; y: number; ground: boolean }

let uid = 0;
const SPARK_COLORS = ['#fde047', '#fb923c', '#f87171', '#ffffff', '#facc15'];
const CRIT_COLORS = ['#67e8f9', '#c084fc', '#f0abfc', '#ffffff', '#a5f3fc'];

const makeSparks = (n: number, crit: boolean, power = 1): Spark[] =>
  Array.from({ length: n }, () => {
    const ang = Math.random() * Math.PI * 2;
    const dist = (70 + Math.random() * 90) * power;
    const colors = crit ? CRIT_COLORS : SPARK_COLORS;
    return {
      id: ++uid,
      dx: Math.cos(ang) * dist,
      dy: Math.sin(ang) * dist,
      c: colors[Math.floor(Math.random() * colors.length)],
      s: 8 + Math.random() * 10 * power,
    };
  });

interface Props {
  monster: Monster;
  monsterKey: string | number;
  score: number;
  combo: number;
  collected: number;
}

export default forwardRef<BattleHandle, Props>(function BattleStage({ monster, monsterKey, score, combo, collected }, ref) {
  const [hp, setHp] = useState(MAX_HP);
  const [shots, setShots] = useState<Shot[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [anim, setAnim] = useState<{ k: number; cls: string }>({ k: 0, cls: 'enter' });
  const [dead, setDead] = useState(false);
  const [recoilK, setRecoilK] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const monsterRef = useRef<HTMLDivElement>(null);

  // 实时量出枪口和怪兽的位置，子弹沿两点连线飞（横屏水平射，竖屏斜着往上射）
  const aim = () => {
    const st = stageRef.current?.getBoundingClientRect();
    const sv = heroRef.current?.querySelector('svg')?.getBoundingClientRect();
    const mo = monsterRef.current?.getBoundingClientRect();
    if (!st || !sv || !mo) return { x: 0, y: 0, dx: 300, dy: 0 };
    const x = sv.left - st.left + (sv.width * 153) / 160;
    const y = sv.top - st.top + (sv.height * 45) / 130;
    const tx = mo.left - st.left + mo.width * 0.45;
    const ty = mo.top - st.top + mo.height * 0.5;
    return { x, y, dx: tx - x, dy: ty - y };
  };

  // 打偏：子弹整条路线都不能碰到怪兽（怪兽范围再往外留一圈），看起来就是真的打偏了
  const aimMiss = (): Omit<Shot, 'id' | 'dmg' | 'crit' | 'kill'> => {
    const st = stageRef.current?.getBoundingClientRect();
    const mo = monsterRef.current?.getBoundingClientRect();
    const base = aim();
    const { x, y } = base;
    if (!st || !mo) return { x, y, dx: 200, dy: -300, miss: 'sky' };
    const pad = 24;
    const box = {
      l: mo.left - st.left - pad, r: mo.right - st.left + pad,
      t: mo.top - st.top - pad, b: mo.bottom - st.top + pad,
    };
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    const groundY = st.height - 18;

    // 线段 (x,y)→(x+dx,y+dy) 是否穿过怪兽的范围（Liang–Barsky 裁剪）
    const hits = (dx: number, dy: number) => {
      let t0 = 0, t1 = 1;
      const edges: [number, number][] = [[-dx, x - box.l], [dx, box.r - x], [-dy, y - box.t], [dy, box.b - y]];
      for (const [p, q] of edges) {
        if (p === 0) { if (q < 0) return false; continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
      return true;
    };

    // 三种打偏方式，随机顺序挨个试，每种试几个随机落点
    const kinds = (['sky', 'ground', 'over'] as const).slice().sort(() => Math.random() - 0.5);
    for (const kind of kinds) {
      for (let i = 0; i < 8; i++) {
        let tx: number, ty: number, stretch = 1;
        if (kind === 'ground') {
          tx = box.l - r(10, 70);            // 打在怪兽前面的地上
          ty = groundY - r(0, 6);
        } else if (kind === 'sky') {
          tx = box.l + (box.r - box.l) * r(-0.4, 0.3); // 往高处打，飞出画面上方
          ty = box.t - r(20, 70);
          stretch = 2.2;
        } else {
          tx = box.r + r(10, 60);             // 越过怪兽头顶，飞出画面右边
          ty = box.t - r(5, 40);
          stretch = 1.6;
        }
        const dx = (tx - x) * stretch, dy = (ty - y) * stretch;
        if (!hits(dx, dy)) return { x, y, dx, dy, miss: kind === 'ground' ? 'ground' : kind === 'sky' ? 'sky' : 'wide' };
      }
    }
    // 实在找不到：几乎垂直往上打
    return { x, y, dx: 40, dy: -(y + 60), miss: 'sky' };
  };

  const [bubble, setBubble] = useState<{ k: number; text: string } | null>(null);
  const [misses, setMisses] = useState<MissMark[]>([]);
  const [boom, setBoom] = useState(0);
  const [rings, setRings] = useState<{ id: number; crit: boolean }[]>([]);
  const alive = useRef(true);

  // 新题 → 新怪兽满血入场
  useEffect(() => {
    setHp(MAX_HP);
    setDead(false);
    setBubble(null);
    setAnim(a => ({ k: a.k + 1, cls: 'enter' }));
    alive.current = true;
  }, [monsterKey]);

  const addFloat = (text: string, cls: string) => {
    const id = ++uid;
    setFloats(f => [...f, { id, text, cls }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 1100);
  };

  const burst = (list: Spark[]) => {
    setSparks(s => [...s, ...list]);
    const ids = new Set(list.map(x => x.id));
    setTimeout(() => setSparks(s => s.filter(x => !ids.has(x.id))), 750);
  };

  const impact = (shot: Shot) => {
    setShots(s => s.filter(x => x.id !== shot.id));
    if (shot.miss) {
      // 落空：在子弹终点（打到地上就冒烟）显示 MISS，然后怪兽邪笑
      const w = stageRef.current?.clientWidth ?? 600;
      const ground = shot.miss === 'ground';
      // MISS 标在子弹落点附近（飞出画面的就标在路线中段），别压住上面的血条、别出画面
      const f = ground ? 1 : 0.55;
      const mark = {
        id: ++uid,
        x: Math.min(Math.max(shot.x + shot.dx * f, 40), w - 40),
        y: Math.max(shot.y + shot.dy * f, 64),
        ground,
      };
      setMisses(m => [...m, mark]);
      setTimeout(() => setMisses(m => m.filter(x => x.id !== mark.id)), 900);
      if (!alive.current) return;
      setAnim(a => ({ k: a.k + 1, cls: 'laugh' }));
      setBubble(b => ({ k: (b?.k ?? 0) + 1, text: shot.taunt || '嘿嘿～' }));
      return;
    }
    setHp(h => Math.max(0, h - shot.dmg));
    addFloat(`${shot.crit ? '暴击 ' : ''}-${shot.dmg}`, shot.crit ? 'crit' : 'dmg');
    burst(makeSparks(shot.crit ? 22 : 14, shot.crit));
    const ring = { id: ++uid, crit: shot.crit };
    setRings(r => [...r, ring]);
    setTimeout(() => setRings(r => r.filter(x => x.id !== ring.id)), 500);
    const amp = shot.kill ? 10 : shot.crit ? 7 : 4;
    stageRef.current?.animate?.(
      [0, amp, -amp, amp * 0.6, -amp * 0.6, 0].map(x => ({ transform: `translate(${x}px, ${x * 0.4}px)` })),
      { duration: shot.kill ? 420 : 260 },
    );
    if (shot.kill) {
      alive.current = false;
      setDead(true);
      setBoom(b => b + 1);
      setBubble(null);
      setTimeout(() => burst(makeSparks(28, shot.crit, 1.8)), 120);
      addFloat('打倒了！', 'ko');
    } else {
      setAnim(a => ({ k: a.k + 1, cls: 'hit' }));
    }
  };

  const recoil = () => {
    setRecoilK(k => k + 1);
    heroRef.current?.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px) rotate(-4deg)' }, { transform: 'translateX(0)' }],
      { duration: 160 },
    );
  };

  useImperativeHandle(ref, () => ({
    fire: (dmg, crit, kill) => {
      recoil();
      setShots(s => [...s, { id: ++uid, dmg, crit, kill, ...aim() }]);
    },
    // 答错：missShot 时开一枪但打偏了，落空后怪兽邪笑；否则怪兽直接邪笑
    taunt: (text, missShot) => {
      if (!alive.current) return;
      if (!missShot) {
        setAnim(a => ({ k: a.k + 1, cls: 'laugh' }));
        setBubble(b => ({ k: (b?.k ?? 0) + 1, text }));
        return;
      }
      recoil();
      setShots(s => [...s, { id: ++uid, dmg: 0, crit: false, kill: false, taunt: text, ...aimMiss() }]);
    },
  }));

  const hpPct = (hp / MAX_HP) * 100;

  return (
    <div className="battle" ref={stageRef}>
      <div className="stars" />
      <div className="ground" />

      <div className="battle-hud">
        <div className="hud-score">⭐ {score}</div>
        <div className={`hud-combo${combo >= 3 ? ' hot' : ''}`}>{combo >= 3 ? `🔥 连对 ${combo} · 暴击中` : `连对 ${combo}`}</div>
        <div className="hud-coll">📒 收集 {collected}/{MONSTERS.length}</div>
      </div>

      {/* 射手 */}
      <div className="hero" ref={heroRef}>
        <Soldier />
        {recoilK > 0 && <span key={recoilK} className={`muzzle${combo >= 3 ? ' crit' : ''}`} />}
      </div>

      {/* 子弹 */}
      {shots.map(s => (
        <div key={s.id} className={`bullet${s.crit ? ' crit' : ''}${s.miss ? ' miss' : ''}`} onAnimationEnd={() => impact(s)}
          style={{
            left: s.x, top: s.y,
            '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, '--ang': `${Math.atan2(s.dy, s.dx)}rad`,
          } as React.CSSProperties} />
      ))}

      {/* 打偏的落点 */}
      {misses.map(m => (
        <div key={m.id} className={`miss-mark${m.ground ? ' ground' : ''}`} style={{ left: m.x, top: m.y }}>
          {m.ground && <span className="dust">💨</span>}
          <span className="miss-text">MISS</span>
        </div>
      ))}

      {/* 怪兽 + 血条 */}
      <div className="monster-zone">
        <div className={`hpbox${dead ? ' gone' : ''}`}>
          <div className="hp-name">
            <span>{monster.n}</span>
            <span className="hp-num">HP {hp}/{MAX_HP}</span>
          </div>
          <div className="hp-bar">
            <div className="hp-lag" style={{ width: `${hpPct}%` }} />
            <div className={`hp-fill${hpPct <= 34 ? ' low' : hpPct <= 67 ? ' mid' : ''}`} style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <div className={`monster ${dead ? 'die' : anim.cls}`} key={`m-${monsterKey}-${anim.k}-${dead}`} ref={monsterRef}>
          {monster.e}
        </div>
        {boom > 0 && dead && <div className="boom" key={`boom-${boom}`}>💥</div>}
        {bubble && !dead && (
          <div className="bubble" key={`b-${bubble.k}`}>
            <span className="smirk">😏</span>{bubble.text}
          </div>
        )}
        {rings.map(r => <i key={r.id} className={`ring${r.crit ? ' crit' : ''}`} />)}
        {sparks.map(s => (
          <i key={s.id} className="spark"
            style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px`, background: s.c, width: s.s, height: s.s } as React.CSSProperties} />
        ))}
        {floats.map(f => <div key={f.id} className={`dmg-float ${f.cls}`}>{f.text}</div>)}
      </div>
    </div>
  );
});
