import { history } from 'umi';
import LevelLayout from '@/components/LevelLayout';
import MathGame from '@/components/MathGame';
import usePersistedState from '@/utils/usePersistedState';
import { MathOp, MathSettings, DEFAULT_SETTINGS, CarryMode, SpeechLang } from '@/utils/mathQuestions';
import '@/components/ConfigPanel.less';
import './index.less';

const RANGES = [10, 20, 100, 1000, 2000];
const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Level6Page() {
  const [op, setOp] = usePersistedState<MathOp>('level6.op', 'add');
  const [saved, setSaved] = usePersistedState<MathSettings>('level6.settings', DEFAULT_SETTINGS);
  const [speakOn, setSpeakOn] = usePersistedState('level6.speak', true);
  const [lang, setLang] = usePersistedState<SpeechLang>('level6.lang', 'zh');
  const [missShot, setMissShot] = usePersistedState('level6.missShot', true);
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  const set = (patch: Partial<MathSettings>) => setSaved({ ...settings, ...patch });

  const radios = <T extends string | number>(name: string, value: T, options: [T, string][], onChange: (v: T) => void) => (
    <div className="chip-group">
      {options.map(([v, label]) => (
        <button key={String(v)} className={value === v ? 'chip active' : 'chip'} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );

  const tablePicker = (selected: number[], onChange: (v: number[]) => void) => (
    <>
      <div className="chip-group">
        {TABLES.map(t => (
          <button
            key={t}
            className={selected.includes(t) ? 'chip active' : 'chip'}
            onClick={() => {
              const next = selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t].sort();
              if (next.length) onChange(next);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="hint">
        <a onClick={() => onChange(TABLES)}>全选</a>
        <a onClick={() => onChange([2, 3, 4, 5])}>2~5</a>
        <a onClick={() => onChange([6, 7, 8, 9])}>6~9</a>
      </div>
    </>
  );

  const carryOptions = (word: string): [CarryMode, string][] => [['any', '随机'], ['must', `必有${word}`], ['none', `不${word}`]];

  const config = (
    <div className="config-panel math-config">
      <div className="config-header">
        <h3>⚙️ 游戏设置</h3>
        <button className="home-btn" onClick={() => history.push('/')}>🏠 返回首页</button>
      </div>

      {op === 'add' && (
        <>
          <div className="config-section">
            <label>加法范围</label>
            {radios('addRange', settings.addRange, RANGES.map(r => [r, `${r}以内`] as [number, string]), v => set({ addRange: v }))}
            <div className="hint">20 以内用横式（会教凑十法）；100 以上用竖式，从个位一位一位算</div>
          </div>
          <div className="config-section">
            <label>进位</label>
            {radios('addCarry', settings.addCarry, carryOptions('进位'), v => set({ addCarry: v }))}
          </div>
        </>
      )}

      {op === 'sub' && (
        <>
          <div className="config-section">
            <label>减法范围</label>
            {radios('subRange', settings.subRange, RANGES.map(r => [r, `${r}以内`] as [number, string]), v => set({ subRange: v }))}
            <div className="hint">20 以内用横式（会教破十法）；100 以上用竖式，退位时打上退位点</div>
          </div>
          <div className="config-section">
            <label>退位</label>
            {radios('subBorrow', settings.subBorrow, carryOptions('退位'), v => set({ subBorrow: v }))}
          </div>
        </>
      )}

      {op === 'mul' && (
        <>
          <div className="config-section">
            <label>怎么练</label>
            {radios('mulMode', settings.mulMode, [['recite', '📖 背口诀'], ['practice', '🎯 练习']], v => set({ mulMode: v }))}
            <div className="hint">
              {settings.mulMode === 'recite'
                ? '口诀表点哪格读哪格，点行首 ▶ 连读一整行'
                : '在选中的口诀里随机出题，答错会提示口诀'}
            </div>
          </div>
          {settings.mulMode === 'practice' && (
            <div className="config-section">
              <label>在这些口诀里出题</label>
              {tablePicker(settings.mulTables, v => set({ mulTables: v }))}
            </div>
          )}
        </>
      )}

      {op === 'div' && (
        <>
          <div className="config-section">
            <label>除法类型</label>
            {radios('divMode', settings.divMode, [['exact', '表内除法'], ['remainder', '有余数除法']], v => set({ divMode: v }))}
            <div className="hint">
              {settings.divMode === 'exact'
                ? '用乘法口诀求商：21 ÷ 3，想“三(七)二十一”，商是 7'
                : '23 ÷ 4 = 5……3：先输商，再输余数（会自动跳过去，也可以按“余”键）'}
            </div>
          </div>
          <div className="config-section">
            <label>除数用哪些口诀</label>
            {tablePicker(settings.divTables, v => set({ divTables: v }))}
          </div>
        </>
      )}

      <div className="config-section">
        <label>朗读语言</label>
        {radios('lang', lang, [['zh', '中文'], ['en', 'English']], v => setLang(v))}
        <label className="row-label" style={{ marginTop: 10 }}>
          <span>答对后朗读算式</span>
          <input type="checkbox" checked={speakOn} onChange={e => setSpeakOn(e.target.checked)} />
        </label>
        <div className="hint">用手机自带的语音朗读，不需要联网</div>
      </div>

      <div className="config-section">
        <label className="row-label">
          <span>答错时子弹打偏</span>
          <input type="checkbox" checked={missShot} onChange={e => setMissShot(e.target.checked)} />
        </label>
        <div className="hint">打开：开枪打偏、落空后怪兽邪笑；关闭：不开枪，怪兽直接邪笑</div>
      </div>

      <div className="config-section info-section">
        <div className="hint">
          🎮 答对一题打怪兽一下，连对 3 题开启暴击（伤害加倍）。答错不扣分，错题过几题会再出现。
          打倒的怪兽收进收集册 📒。电脑上直接按数字键，回车确认，退格删除。
        </div>
      </div>
    </div>
  );

  return <LevelLayout game={<MathGame op={op} onOpChange={setOp} settings={settings} speakOn={speakOn} lang={lang} missShot={missShot} />} config={config} />;
}
