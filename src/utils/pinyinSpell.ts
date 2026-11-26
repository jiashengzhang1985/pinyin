// 单个汉字的拼读：声母 → 韵母（带声调）→ 整个音节，例如 对：d → uì → duì（两拼法）。
// 全部复用 public/mp3 里的音节录音：
//   声母用呼读音（b 读 bō，d 读 dē……）
//   韵母用读音相同的音节录音（ui 读 wēi，iu 读 yōu，ü 读 yū……），声调和原字一致
//   o / eng / ong 不能单独成音节，原录音库里没有：o1-4、eng1-4、ong1-4.mp3
//   是从 fo、heng、hong 的录音切掉开头的辅音得到的（同一个人的声音，声调一致）
// 不拼读、只读整个字的情况：整体认读音节、零声母音节。
import { pinyin } from 'pinyin-pro';

// 声母的呼读音
const INITIAL_SOUND: Record<string, [string, number]> = {
  b: ['bo', 1], p: ['po', 1], m: ['mo', 1], f: ['fo', 1],
  d: ['de', 1], t: ['te', 1], n: ['ne', 1], l: ['le', 1],
  g: ['ge', 1], k: ['ke', 1], h: ['he', 1],
  j: ['ji', 1], q: ['qi', 1], x: ['xi', 1],
  zh: ['zhi', 1], ch: ['chi', 1], sh: ['shi', 1], r: ['ri', 4],
  z: ['zi', 1], c: ['ci', 1], s: ['si', 1],
  y: ['yi', 1], w: ['wu', 1],
};

// 韵母 → 读音相同、有录音的音节
const FINAL_SOUND: Record<string, string> = {
  a: 'a', o: 'o', e: 'e', ai: 'ai', ei: 'ei', ao: 'ao', ou: 'ou',
  an: 'an', en: 'en', ang: 'ang', eng: 'eng', ong: 'ong', er: 'er',
  i: 'yi', u: 'wu', ü: 'yu',
  ia: 'ya', ie: 'ye', iao: 'yao', iu: 'you', ian: 'yan', in: 'yin',
  iang: 'yang', ing: 'ying', iong: 'yong',
  ua: 'wa', uo: 'wo', uai: 'wai', ui: 'wei', uan: 'wan', un: 'wen', uang: 'wang',
  üe: 'yue', üan: 'yuan', ün: 'yun',
};

// 整体认读音节：课本上不拆开拼
const WHOLE = new Set([
  'zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si',
  'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying',
]);

export interface SpellPart {
  syllable: string; // 录音的音节（ü 写作 ü）
  tone: number;     // 0 表示轻声
}

/** 单个汉字的拼读顺序；不适合拼读时返回 null（照常只读整个字） */
export const spellHanzi = (hz: string): SpellPart[] | null => {
  if ([...hz].length !== 1) return null;
  const m = (pinyin(hz, { toneType: 'num' }) || '').toLowerCase().match(/^([a-zü]+)(\d)$/);
  if (!m) return null;
  const syllable = m[1];
  const tone = Number(m[2]);
  if (WHOLE.has(syllable)) return null;

  const initial = pinyin(hz, { pattern: 'initial' });
  const init = INITIAL_SOUND[initial];
  if (!init) return null; // 零声母（安、儿……）

  // y / w 开头的音节按课本拼：y-ā-yā、y-ǒu-yǒu、w-èi-wèi
  const final =
    initial === 'y' || initial === 'w'
      ? syllable.slice(1)
      : pinyin(hz, { pattern: 'final', toneType: 'none' });
  const finalSound = FINAL_SOUND[final];
  if (!finalSound) return null;

  return [
    { syllable: init[0], tone: init[1] },
    { syllable: finalSound, tone },
    { syllable, tone },
  ];
};
