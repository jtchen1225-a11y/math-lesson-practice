#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""summarize_evidence.py — 把一節課的學習證據整理成摘要，作為寫課後反思與下一節調整的依據。

用法（PowerShell）：
  python "<技能資料夾>\\scripts\\summarize_evidence.py" --csv "課堂紀錄-xxx.csv" --exit "已掌握=18,部分掌握=9,尚未掌握=5" --out "output\\<名稱>\\evidence-summary.md"

  --csv    簡報「課堂紀錄」下載的 CSV（選填）
  --exit   教師批改出口題後的三類人數（選填）
  --delayed 延遲檢測的三類人數（選填，格式同 --exit）；只有人數時無法分辨個別學生，只能比較整體變化
  --track  逐位追蹤的 CSV（選填）：欄位「學號,出口題,延遲檢測」，值為已掌握／部分掌握／尚未掌握；
           分出真正掌握、短暫學會、延後學會、尚未掌握。摘要會列出學號，請勿公開。
  --threshold  選對率低於多少要標示跟進，預設 70（%）
  --csv、--exit、--delayed、--track 至少要有一個。

只做統計與標示，不判斷原因，也不產生任何學生表現：原因分析與下一節調整由教師或 Agent 依這份摘要撰寫。
只處理人數，不處理姓名。不連網。結束代碼：0 成功｜2 輸入錯誤
"""
import argparse
import csv
import os
import re
import sys

EXIT_KEYS = ('已掌握', '部分掌握', '尚未掌握')
MIN_SAMPLE = 5


def fail(msg):
    print('❌ ' + msg, file=sys.stderr)
    sys.exit(2)


def read_votes(path):
    try:
        with open(path, encoding='utf-8-sig', newline='') as fh:
            rows = list(csv.DictReader(fh))
    except OSError as e:
        fail(f'無法讀取 {path}：{e}')
    need = {'頁面', '問題', '選項', '人數'}
    if rows and not need <= set(rows[0]):
        fail(f'CSV 欄位應包含 {sorted(need)}，實際為 {list(rows[0])}')
    pages = {}
    for r in rows:
        try:
            n = int(r['人數'])
        except ValueError:
            fail(f'人數不是整數：{r}')
        if n < 0:
            fail(f'人數不可為負：{r}')
        p = pages.setdefault((r['頁面'], r['問題']), [])
        p.append({'label': r['選項'], 'n': n, 'ok': (r.get('正解') or '').strip()})
    return pages


def read_track(path):
    try:
        with open(path, encoding='utf-8-sig', newline='') as fh:
            rows = list(csv.DictReader(fh))
    except OSError as e:
        fail(f'無法讀取 {path}：{e}')
    if not rows:
        fail(f'{path} 沒有資料')
    if not {'學號', '出口題', '延遲檢測'} <= set(rows[0]):
        fail(f'追蹤 CSV 欄位應為 學號,出口題,延遲檢測，實際為 {list(rows[0])}')
    groups = {'真正掌握': [], '短暫學會': [], '延後學會': [], '尚未掌握': []}
    for r in rows:
        ex, de = r['出口題'].strip(), r['延遲檢測'].strip()
        if ex not in EXIT_KEYS or de not in EXIT_KEYS:
            fail(f'值應為 {"／".join(EXIT_KEYS)}：{r}')
        a, b = ex == '已掌握', de == '已掌握'
        groups['真正掌握' if a and b else '短暫學會' if a else '延後學會' if b else '尚未掌握'].append(r['學號'].strip())
    return groups


def parse_exit(text):
    got = {}
    for part in re.split(r'[,，、]', text):
        m = re.fullmatch(r'\s*(已掌握|部分掌握|尚未掌握)\s*[=＝:：]\s*(\d+)\s*', part)
        if not m:
            fail(f'--exit 格式應為「已掌握=18,部分掌握=9,尚未掌握=5」，無法解讀：「{part}」')
        got[m.group(1)] = int(m.group(2))
    return {k: got.get(k, 0) for k in EXIT_KEYS}


def main():
    for st in (sys.stdout, sys.stderr):
        try:
            st.reconfigure(encoding='utf-8')
        except Exception:
            pass
    ap = argparse.ArgumentParser(description='整理課堂票數與出口題人數')
    ap.add_argument('--csv')
    ap.add_argument('--exit')
    ap.add_argument('--delayed')
    ap.add_argument('--track')
    ap.add_argument('--threshold', type=int, default=70)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    if not (a.csv or a.exit or a.delayed or a.track):
        fail('--csv、--exit、--delayed、--track 至少要有一個')

    L = ['# 學習證據摘要', '', '> 只有統計，沒有原因判斷。人數來自教師提供的資料；人數少時比例僅供參考。', '']
    follow = []
    if a.exit:
        ex = parse_exit(a.exit)
        total = sum(ex.values())
        if not total:
            fail('--exit 的總人數是 0')
        L += ['## 出口題', '', '| 結果 | 人數 | 比例 |', '|------|------|------|']
        L += [f'| {k} | {ex[k]} | {ex[k] / total:.0%} |' for k in EXIT_KEYS]
        L += ['']
        if total < MIN_SAMPLE:
            L += [f'⚠ 只有 {total} 人，比例僅供參考。', '']
        share = (ex['部分掌握'] + ex['尚未掌握']) / total
        if share >= 0.5:
            follow.append(f'出口題有 {share:.0%} 未完全掌握：下一節起點宜先回到本節核心概念')
        elif ex['尚未掌握']:
            follow.append(f'出口題有 {ex["尚未掌握"]} 人尚未掌握：安排小組或個別跟進')
    if a.delayed:
        de = parse_exit(a.delayed)
        total = sum(de.values())
        if not total:
            fail('--delayed 的總人數是 0')
        L += ['## 延遲檢測', '', '| 結果 | 人數 | 比例 |', '|------|------|------|']
        L += [f'| {k} | {de[k]} | {de[k] / total:.0%} |' for k in EXIT_KEYS]
        L += ['']
        if a.exit:
            ex = parse_exit(a.exit)
            ex_total = sum(ex.values())
            drop = ex['已掌握'] / ex_total - de['已掌握'] / total
            L += [f"已掌握比例：出口題 {ex['已掌握'] / ex_total:.0%} → 延遲檢測 {de['已掌握'] / total:.0%}。只比較整體；要分辨個別學生請用 --track。", '']
            if drop >= 0.15:
                follow.append(f'已掌握比例下降 {drop:.0%}：可能有學生只是短暫學會，宜增加間隔重現並改變情境')
    if a.track:
        groups = read_track(a.track)
        total = sum(len(v) for v in groups.values())
        L += ['## 逐位追蹤（短暫學會或真正掌握）', '', '> 含學號，請勿公開或投影。部分掌握視為「未掌握」。', '', '| 判斷 | 人數 | 比例 | 學號 |', '|------|------|------|------|']
        L += [f"| {k} | {len(v)} | {len(v) / total:.0%} | {'、'.join(v)} |" for k, v in groups.items()]
        L += ['']
        if groups['短暫學會']:
            follow.append(f"{len(groups['短暫學會'])} 人屬短暫學會：增加間隔重現，改變情境再練")
        if groups['尚未掌握']:
            follow.append(f"{len(groups['尚未掌握'])} 人尚未掌握：找出成因，小組或個別重建概念")
    if a.csv:
        pages = read_votes(a.csv)
        L += ['## 課堂票數', '']
        if not pages:
            L += ['CSV 沒有資料。', '']
        for (sec, q), opts in pages.items():
            total = sum(o['n'] for o in opts)
            L += [f'### {sec}　{q}', '', '| 選項 | 人數 | 比例 | 正解 |', '|------|------|------|------|']
            L += [f"| {o['label']} | {o['n']} | {(o['n'] / total if total else 0):.0%} | {'✓' if o['ok'] == '是' else ''} |" for o in opts]
            L += ['']
            right = [o for o in opts if o['ok'] == '是']
            if right and total:
                rate = sum(o['n'] for o in right) / total
                L += [f'選對率：{rate:.0%}（{total} 人作答）', '']
                if rate * 100 < a.threshold:
                    wrong = max((o for o in opts if o['ok'] != '是'), key=lambda o: o['n'], default=None)
                    tail = f"；最多人選錯的是「{wrong['label']}」（{wrong['n']} 人）" if wrong and wrong['n'] else ''
                    follow.append(f'{sec}「{q}」選對率 {rate:.0%}{tail}')
    L += ['## 建議優先跟進', '']
    L += [f'- {x}' for x in follow] or ['- 依目前資料，沒有達到標示條件的項目。']
    L += ['', '## 待教師或 Agent 依真實證據填寫', '',
          '1. 哪些設計有效？', '2. 哪些學生仍然有困難？（用類別或人數，不寫姓名）', '3. 哪些錯誤最值得跟進？', '4. 下一節課需要調整甚麼？', '']
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(L))
    print(f'✅ 已寫入 {a.out}；標示跟進 {len(follow)} 項')
    return 0


if __name__ == '__main__':
    sys.exit(main())
