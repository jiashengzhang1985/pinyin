// 第四关设置：拍照、从相册选（手机 / App），或选择本地照片文件（电脑网页），AI 识别出要学的单词和书上的例句，追加到词表。
// 只追加：原有单词一个不删；已有的单词不重复添加，书上的例句补进这个词的例句里。
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { recognizePhotoWords, appendSentences, sentenceState } from '@/utils/exampleSentence';
import type { PhotoWord } from '@/utils/exampleSentence';
import type { WordEntry } from './GameCanvas';
import { useShowVirtualKeyboard } from './VirtualKeyboard';

// 照片缩小到长边 1600 像素再上传：够 AI 看清文字，上传也快
const loadImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片打不开')); };
    img.src = url;
  });

interface PlanItem extends PhotoWord {
  hint?: string; // 例句按“单词 + 中文意思”保存；已有单词用列表里的中文
}
interface Plan {
  add: PlanItem[];          // 新单词：加到列表（带书上的例句）
  sentenceOnly: PlanItem[]; // 已有单词：只补书上的例句
  unchanged: PlanItem[];    // 已有单词，例句也已经有了：不变（不在确认框里列出）
}

const makePlan = (words: PhotoWord[], wordList: WordEntry[]): Plan => {
  const have = new Map(wordList.map(w => [w.en.trim().toLowerCase(), w]));
  const seen = new Set<string>();
  const plan: Plan = { add: [], sentenceOnly: [], unchanged: [] };
  words.forEach(w => {
    if (seen.has(w.en)) return;
    seen.add(w.en);
    const old = have.get(w.en);
    if (!old) {
      plan.add.push({ ...w, hint: w.zh.trim() || undefined });
      return;
    }
    const hint = old.zh.trim() || undefined;
    const exists = !w.sentence || sentenceState('en', w.en, hint).list.some(s => s.text.trim().toLowerCase() === w.sentence!.trim().toLowerCase());
    (exists ? plan.unchanged : plan.sentenceOnly).push({ ...w, zh: old.zh, hint });
  });
  return plan;
};

// 识别结果确认框：列出识别到的内容和将要做的事，确认后才导入
function ConfirmDialog({ plan, onConfirm, onCancel }: { plan: Plan; onConfirm: () => void; onCancel: () => void }) {
  const nothing = !plan.add.length && !plan.sentenceOnly.length;
  const row = (w: PlanItem) => (
    <li key={w.en}>
      <b>{w.en}</b> {w.zh}
      {w.sentence && (
        <div className="pd-sentence">
          {w.sentence}
          {w.sentenceZh && <span>（{w.sentenceZh}）</span>}
        </div>
      )}
    </li>
  );
  return (
    <div className="photo-dialog-backdrop" onClick={onCancel}>
      <div className="photo-dialog" onClick={e => e.stopPropagation()}>
        <h4>识别结果</h4>
        {plan.add.length > 0 && (
          <section>
            <div className="pd-title">➕ 新增 {plan.add.length} 个单词到列表末尾</div>
            <ul>{plan.add.map(row)}</ul>
          </section>
        )}
        {plan.sentenceOnly.length > 0 && (
          <section>
            <div className="pd-title">📝 已在列表里，补上书上的例句（原有例句保留）</div>
            <ul>{plan.sentenceOnly.map(row)}</ul>
          </section>
        )}
        {nothing && <div className="pd-title">图片里的单词和例句都已经在列表里了，不需要导入。</div>}
        <div className="pd-note">原有的单词和例句都不会删除。</div>
        <div className="pd-actions">
          <button className="pd-cancel" onClick={onCancel}>取消</button>
          <button className="pd-ok" onClick={onConfirm} disabled={nothing}>{nothing ? '没有要导入的' : '确认导入'}</button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  wordList: WordEntry[];
  onWordListChange?: (list: WordEntry[]) => void;
  disabled?: boolean;
}

export default function PhotoWordImport({ wordList, onWordListChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // 手机 / App：拍照 + 选图片（相册或手机里的图片文件）；电脑网页：选择本地照片文件
  const touch = useShowVirtualKeyboard();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // 识别结果，等用户确认后才导入
  const [plan, setPlan] = useState<Plan | null>(null);

  const onFile = async (file: File | undefined, input: HTMLInputElement) => {
    if (!file) return;
    setBusy(true);
    setMsg('正在识别照片，大约需要 5～10 秒……');
    try {
      const base64 = await loadImage(file);
      const words = await recognizePhotoWords(base64);
      if (words === null) {
        setMsg('识别失败：请检查网络，稍后再试');
        return;
      }
      if (!words.length) {
        setMsg('没有认出要学的单词，请拍清楚一点再试');
        return;
      }
      setMsg('');
      setPlan(makePlan(words, wordList));
    } catch {
      setMsg('照片读取失败，请换一张再试');
    } finally {
      setBusy(false);
      input.value = ''; // 同一张照片可以再选一次
    }
  };

  // 确认后导入：新词追加到列表末尾，书上的例句补进对应单词（原有的单词、例句都保留）
  const confirm = () => {
    if (!plan) return;
    if (plan.add.length) onWordListChange?.([...wordList, ...plan.add.map(w => ({ en: w.en, zh: w.zh }))]);
    [...plan.add, ...plan.sentenceOnly].forEach(w => {
      if (!w.sentence) return;
      appendSentences('en', w.en, w.hint, [w.sentenceZh ? { text: w.sentence, translation: w.sentenceZh } : { text: w.sentence }]);
    });
    const parts: string[] = [];
    if (plan.add.length) parts.push(`新增 ${plan.add.length} 个单词：${plan.add.map(w => w.en).join('、')}`);
    if (plan.sentenceOnly.length) parts.push(`给 ${plan.sentenceOnly.map(w => w.en).join('、')} 加了书上的例句`);
    setMsg(parts.length ? `✅ 已导入：${parts.join('；')}。` : '没有需要导入的内容');
    setPlan(null);
  };

  return (
    <div className="photo-import">
      <div className="photo-btns">
        {touch ? (
          <>
            <button className="photo-btn" disabled={disabled || busy} onClick={() => cameraRef.current?.click()}>
              {busy ? '⏳ 识别中……' : '📷 拍照识别单词'}
            </button>
            <button className="photo-btn alt" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
              🖼️ 选图片
            </button>
          </>
        ) : (
          <button className="photo-btn" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
            {busy ? '⏳ 识别中……' : '🖼️ 选择照片识别单词'}
          </button>
        )}
      </div>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => onFile(e.target.files?.[0], e.target)}
      />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => onFile(e.target.files?.[0], e.target)}
      />
      {plan && createPortal(<ConfirmDialog plan={plan} onConfirm={confirm} onCancel={() => { setPlan(null); setMsg('已取消，没有导入任何内容'); }} />, document.body)}
      <div className="hint">
        {msg || `${touch ? '拍' : '选一张'}课本或练习册的照片，AI 自动找出要学的单词和书上的例句，追加到列表（原有单词不会删除）`}
      </div>
    </div>
  );
}
