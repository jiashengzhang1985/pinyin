#!/usr/bin/env python3
# 生成 public/audio-ends.json：每个录音里“声音真正结束”的时间（秒）。
# 录音末尾常带 0.1～0.6 秒不等的静音，拼读时按这个时间截停，字与字之间的停顿才准确。
# 用法：python3 scripts/gen-audio-ends.py   （新增或替换录音后重新运行）
import array, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public')
DIRS = ['mp3', 'voice/en/letters']
RATE, FRAME = 16000, 160  # 10ms 一帧

def sound_end(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-af', 'highpass=f=120', '-ac', '1',
                          '-ar', str(RATE), '-f', 's16le', '-'], capture_output=True).stdout
    a = array.array('h', raw)
    if sys.byteorder == 'big': a.byteswap()
    e = [sum(abs(x) for x in a[i:i + FRAME]) / FRAME for i in range(0, len(a), FRAME)]
    if not e or max(e) == 0: return None
    pk = max(range(len(e)), key=e.__getitem__)
    th = e[pk] * 0.08
    # 从最响处往后走，连续 100ms 都低于阈值就算结束（忽略末尾的杂音、咔哒声）
    end, quiet = pk, 0
    for i in range(pk, len(e)):
        if e[i] >= th: end, quiet = i, 0
        else:
            quiet += 1
            if quiet >= 10: break
    return round(min(len(a) / RATE, (end + 1) * FRAME / RATE + 0.06), 2)

files = [f'{d}/{n}' for d in DIRS for n in sorted(os.listdir(os.path.join(ROOT, d)))
         if n.endswith(('.mp3', '.m4a'))]
with ThreadPoolExecutor(8) as ex:
    ends = dict(zip(files, ex.map(lambda f: sound_end(os.path.join(ROOT, f)), files)))
out = {f: t for f, t in ends.items() if t}
with open(os.path.join(ROOT, 'audio-ends.json'), 'w') as fp:
    json.dump(out, fp, separators=(',', ':'), sort_keys=True)
print(f'{len(out)} files -> public/audio-ends.json')
