#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_audio.py — 依旁白設定檔產生動畫頁（LS.anim）用的預錄語音 mp3（預設香港粵語）。

用法（PowerShell）：
  <有 edge-tts 的 python> "<技能資料夾>\\scripts\\make_audio.py" --config "narration.json" --out "output\\<名稱>\\site\\audio"

narration.json（UTF-8）：
  {
    "voice": "zh-HK-HiuGaaiNeural",      // 選填；香港粵語女聲。男聲：zh-HK-WanLungNeural
    "rate": "-5%",                         // 選填；語速
    "items": [ {"file": "s1.mp3", "text": "要讀出來的粵語旁白"} ]
  }
  text 是「讀出來的字」：數字寫成中文（九、十六）、a² 寫成「a 嘅平方」，讀音才自然；
  畫面字幕寫在 chN.js 的 say，可以和 text 不同。

注意：
  - 需要已安裝的 edge-tts（本腳本不會安裝任何套件）。找不到時結束代碼 2。
  - edge-tts 會把 text 送到微軟 Edge 朗讀服務（需要網路，非正式公開介面）。
    不要放學生姓名、成績或其他個資；只放教學旁白。
  - 產生的 mp3 放在 site\\audio\\，簡報播放時不需要網路。
結束代碼：0 成功｜1 部分失敗｜2 設定錯誤或缺少 edge-tts
"""
import argparse
import asyncio
import json
import os
import re
import sys


def main():
    for st in (sys.stdout, sys.stderr):
        try:
            st.reconfigure(encoding='utf-8')
        except Exception:
            pass
    ap = argparse.ArgumentParser(description='產生 LS.anim 用的預錄語音 mp3（edge-tts）')
    ap.add_argument('--config', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--overwrite', action='store_true', help='覆寫已存在的 mp3')
    a = ap.parse_args()
    try:
        import edge_tts
    except ImportError:
        print('❌ 找不到 edge-tts。請改用已安裝 edge-tts 的 Python 執行；本腳本不會自動安裝。', file=sys.stderr)
        return 2
    try:
        with open(a.config, encoding='utf-8-sig') as fh:
            cfg = json.load(fh)
    except (OSError, json.JSONDecodeError) as e:
        print(f'❌ 無法讀取 {a.config}：{e}', file=sys.stderr)
        return 2
    items = cfg.get('items')
    if not isinstance(items, list) or not items:
        print('❌ items 必須是非空陣列', file=sys.stderr)
        return 2
    bad = [i for i, it in enumerate(items)
           if not isinstance(it, dict) or not re.fullmatch(r'[\w\-]+\.mp3', str(it.get('file', ''))) or not str(it.get('text', '')).strip()]
    if bad:
        print(f'❌ items 第 {bad} 項格式錯誤（file 只能用英數字、-、_，副檔名 .mp3；text 必填）', file=sys.stderr)
        return 2
    voice, rate = cfg.get('voice', 'zh-HK-HiuGaaiNeural'), cfg.get('rate', '+0%')
    os.makedirs(a.out, exist_ok=True)

    async def run():
        fails = 0
        for it in items:
            path = os.path.join(a.out, it['file'])
            if os.path.exists(path) and not a.overwrite:
                print(f'   略過（已存在）：{path}')
                continue
            try:
                await edge_tts.Communicate(it['text'], voice, rate=rate).save(path)
                print(f'✅ {path}（{os.path.getsize(path)} bytes）')
            except Exception as e:
                fails += 1
                print(f'❌ {it["file"]}：{e}', file=sys.stderr)
        return fails

    fails = asyncio.run(run())
    print(f'聲音：{voice}，語速 {rate}；共 {len(items)} 段，失敗 {fails} 段')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
