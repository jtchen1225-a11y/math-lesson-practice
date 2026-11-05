#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""validate_deck.py — 課堂簡報兩層檢查（沿用 math-review-deck 本機適配版的驗證工具）。

用法（PowerShell）：
  python "<技能資料夾>\\scripts\\validate_deck.py" "<site 資料夾>" [選項]

  --report-dir <資料夾>   報告輸出位置（預設：site 的上層資料夾）
  --window 1920x1080      版面檢查（?check）用的視窗大小
  --cap 2001              每個滑桿最多實測幾個值；合法值更多時抽樣並在報告標示
  --skip-layout           不做版面檢查
  --viewports A B ...     全狀態版面檢查用的視窗（預設 1280x720 1366x657 1536x730 1920x937）
  --browser <exe>         指定 Edge 或 Chrome（預設自動找已安裝的 Edge，其次 Chrome）

檢查內容：
  1. 格式：執行原版 verify_deck.js（靜態／格式檢查，含已知限制）。
  2. 互動：把 site 複製到暫存資料夾，在暫存的 index.html 注入 validate_harness.js，
     用無頭瀏覽器（獨立暫存設定、封鎖 DNS）載入實際的 engine.js、svg.js、MathJax 與章節檔，
     逐頁、逐滑桿觸發真正的 input／change 事件並檢查（見 validate_harness.js 檔頭）。成品資料夾不會被修改。
  3. 公式：MathJax 錯誤節點、殘留原始 TeX（互動過程中每個值都檢查）。
  4. 版面：用 index.html?check 在指定視窗大小量測（超出、實際字級）；
     全狀態版面（validate_states.js）在多種視窗逐頁實際點開提示、答案、揭曉、修正，拖步驟、滑桿、動畫，
     每個狀態都不可超框、圖中文字不可低於 28pt，封面開始按鈕要在畫面內。放不下就拆頁，不可縮字。
  5. 數學內容：程式不判定，一律列為「需人工核對」。

結束代碼：0 全部通過（數學內容仍須人工核對）｜1 有任何失敗｜2 找不到瀏覽器、Node 或 site 不完整｜3 瀏覽器驗證未完成（逾時或沒有結果）
不安裝任何套件或瀏覽器、不連網、不修改成品。
"""
import argparse
import datetime
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
HARNESS = HERE / 'validate_harness.js'
STATES = HERE / 'validate_states.js'
VIEWPORTS = ['1280x720', '1366x657', '1536x730', '1920x937']
VERIFY = HERE / 'verify_deck.js'
FORMULA_KINDS = {'公式排版錯誤', '公式未排版'}
BROWSERS = [
    Path(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe',
    Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'Microsoft/Edge/Application/msedge.exe',
    Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'Google/Chrome/Application/chrome.exe',
]


def find_browser(explicit):
    if explicit:
        return Path(explicit) if Path(explicit).is_file() else None
    return next((b for b in BROWSERS if b.is_file()), None)


def run_browser(browser, url, profile, window, budget_ms, timeout_s):
    args = [str(browser), '--headless=new', f'--user-data-dir={profile}', '--no-first-run', '--disable-extensions',
            '--disable-sync', '--host-resolver-rules=MAP * ~NOTFOUND', f'--window-size={window}',
            f'--virtual-time-budget={budget_ms}', '--dump-dom', url]
    try:
        p = subprocess.run(args, capture_output=True, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        return None
    return p.stdout.decode('utf-8', errors='replace')


def format_check(site):
    node = shutil.which('node')
    if not node:
        return {'status': '未執行', 'reason': '找不到 Node.js', 'output': []}
    p = subprocess.run([node, str(VERIFY), str(site)], capture_output=True)
    out = (p.stdout + p.stderr).decode('utf-8', errors='replace').strip().splitlines()
    return {'status': '通過' if p.returncode == 0 else '失敗', 'exit': p.returncode, 'output': out}


def interactive_check(site, browser, cap, tmp):
    work = Path(tmp) / 'site'
    shutil.copytree(site, work)
    shutil.copy(HARNESS, work / 'mrd-validate-harness.js')
    idx = (work / 'index.html').read_text(encoding='utf-8')
    m = re.search(r'<head[^>]*>', idx)
    if not m:
        return None, 'index.html 找不到 <head>'
    idx = idx[:m.end()] + '\n  <script src="mrd-validate-harness.js"></script>' + idx[m.end():]
    (work / 'index.html').write_text(idx, encoding='utf-8')
    url = (work / 'index.html').as_uri() + f'?validate&cap={cap}'
    dom = run_browser(browser, url, Path(tmp) / 'profile-v', '1920,1080', 3_600_000, 900)
    if dom is None:
        return None, '瀏覽器執行逾時'
    mm = re.search(r'<pre id="mrd-validate-result">(.*?)</pre>', dom, re.S)
    if not mm:
        return None, '沒有取得驗證結果（頁面可能沒有完成載入或驗證逾時）'
    return json.loads(html.unescape(mm.group(1))), None


def layout_check(site, browser, window, tmp):
    url = (Path(site) / 'index.html').as_uri() + '?check'
    dom = run_browser(browser, url, Path(tmp) / 'profile-c', window.replace('x', ','), 600_000, 600)
    if dom is None:
        return {'status': '未完成', 'reason': '瀏覽器執行逾時'}
    m = re.search(r'<script type="application/json" id="mrd-check-json">(.*?)</script>', dom, re.S)
    if not m:
        return {'status': '未完成', 'reason': '沒有取得 ?check 結果（engine.js 可能是舊版）'}
    rep = json.loads(m.group(1))
    if not rep['pages']:
        # 沒有任何內容頁（例如章節檔載入失敗）時不可判為通過
        return {'status': '失敗', 'viewport': rep['viewport'], 'pages': [], 'failPages': ['沒有任何內容頁被渲染']}
    bad = [p for p in rep['pages'] if p['overflow'] or p['small'] or p['merr'] or p['raw'] or p['failed']]
    return {'status': '通過' if not bad else '失敗', 'viewport': rep['viewport'], 'pages': rep['pages'], 'failPages': [p['page'] for p in bad]}


def states_check(site, browser, viewports, tmp):
    """全狀態版面：每種視窗 × 每頁 × 每個互動狀態。在暫存複本注入腳本，成品資料夾不會被修改。"""
    work = Path(tmp) / 'site-states'
    shutil.copytree(site, work)
    shutil.copy(STATES, work / 'mrd-validate-states.js')
    idx = (work / 'index.html').read_text(encoding='utf-8')
    (work / 'index.html').write_text(idx.replace('</body>', '<script src="mrd-validate-states.js"></script></body>'), encoding='utf-8')

    def one(vp):
        w, h = map(int, vp.split('x'))
        # 無頭瀏覽器的視窗含瀏覽器外框：加上外框才會得到指定的可視範圍；實際值記在結果內
        dom = run_browser(browser, (work / 'index.html').as_uri(), Path(tmp) / f'profile-s{w}', f'{w + 30},{h + 142}', 900_000, 900)
        m = re.search(r'<pre id="mrd-states-result">(.*?)</pre>', dom or '', re.S)
        return vp, (json.loads(html.unescape(m.group(1))) if m else None)

    with ThreadPoolExecutor(len(viewports)) as ex:
        results = list(ex.map(one, viewports))
    undone = [vp for vp, r in results if r is None]
    runs = [dict(r, requested=vp) for vp, r in results if r is not None]
    if undone or not runs:
        return {'status': '未完成', 'reason': f'以下視窗沒有取得結果：{undone}', 'runs': runs}
    issues = sum(len(r['issues']) for r in runs)
    empty = [r['requested'] for r in runs if not r['pages']]
    return {'status': '失敗' if issues or empty else '通過', 'runs': runs, 'issues': issues, 'states': sum(r['states'] for r in runs),
            'failPages': sorted({q['page'] for r in runs for q in r['issues']})}


def handout_check(site, browser, tmp):
    """紙本（handout.html）：有題目、公式排版成功、學生學習單沒有答案。列印效果仍需人工預覽。"""
    page = Path(site) / 'handout.html'
    if not page.is_file():
        return {'status': '略過', 'reason': '沒有 handout.html'}
    dom = run_browser(browser, page.as_uri() + '?check', Path(tmp) / 'profile-h', '1280,900', 120_000, 180)
    m = re.search(r'<script type="application/json" id="ho-check-json">(.*?)</script>', dom or '', re.S)
    if not m:
        return {'status': '未完成', 'reason': '沒有取得紙本檢查結果'}
    r = json.loads(m.group(1))
    probs = []
    if not r['taskPages'] and not r['exits']:
        probs.append('沒有分層任務，也沒有出口題')
    if r['rawTex'] or r['mathErrors']:
        probs.append(f"公式問題：殘留 TeX {r['rawTex']}、錯誤 {r['mathErrors']}")
    if r['studentHasAnswers']:
        probs.append('學生學習單出現答案')
    return dict(r, status='失敗' if probs else '通過', problems=probs)


def split_problems(res):
    """把每個問題分到「互動／繪圖」或「公式」。"""
    inter, formula = [], []
    def add(page, slider, value, probs):
        for p in probs:
            row = {'page': page, 'slider': slider, 'value': value, 'kind': p['kind'], 'msg': p['msg']}
            (formula if p['kind'] in FORMULA_KINDS else inter).append(row)
    add('載入', '', '', res.get('loadProblems', []))
    for pg in res.get('pages', []):
        add(pg['page'], '', '初次繪製', pg.get('initial', []))
        for s in pg.get('sliders', []):
            for f in s['failures']:
                add(pg['page'], s['slider'], f['value'], f['problems'])
        for f in (pg.get('combos') or {}).get('failures', []):
            add(pg['page'], '端點組合', f['value'], f['problems'])
    return inter, formula


def write_report(path_md, path_json, data):
    path_json.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    L = [f"# 課堂簡報驗證報告", '', f"- 對象：`{data['site']}`", f"- 時間：{data['time']}", f"- 瀏覽器：`{data['browser']}`（無頭模式、暫存設定、DNS 封鎖）", '']
    L += ['## 總覽', '', '| 層次 | 狀態 |', '|------|------|']
    for k, v in data['summary'].items():
        L.append(f'| {k} | {v} |')
    L += ['', '## 1. 格式（原版 verify_deck.js；靜態檢查，有已知限制）', '', '```'] + data['format'].get('output', [])[-15:] + ['```', '']
    L += ['## 2. 互動（瀏覽器實測）', '']
    inter = data.get('interactive')
    if not inter:
        L.append(f"未完成：{data.get('interactiveError')}")
    else:
        L += ['| 頁 | 標題 | 滑桿 | 範圍／步進 | 合法值數 | 實測值數 | 含最小 | 含最大 | 抽樣 | 失敗值數 | 備註 |',
              '|----|------|------|-----------|---------|---------|-------|-------|------|---------|------|']
        for pg in inter['pages']:
            if pg.get('divider'):
                continue
            if not pg['sliders']:
                L.append(f"| {pg['page']} | {pg['title'][:16]} | （無滑桿） | | | | | | | | 初次繪製問題 {len(pg['initial'])} 項 |")
            for s in pg['sliders']:
                L.append(f"| {pg['page']} | {pg['title'][:16]} | `{s['slider']}` | {s['min']}～{s['max']}／{s['step']} | {s.get('legalCount') or '—'} | "
                         f"{s['testedCount']} | {'✅' if s['includesMin'] else '❌'} | {'✅' if s['includesMax'] else '❌'} | {'是' if s['sampled'] else '否'} | "
                         f"{s['failureCount']} | {s['note']} {s['others']} |")
            if pg.get('combos'):
                c = pg['combos']
                L.append(f"| {pg['page']} | | 端點組合 | | | {len(c.get('tested', []))} | | | | {len(c.get('failures', []))} | {c['note']} |")
        L += ['', '### 實測值', '']
        for pg in inter['pages']:
            for s in pg.get('sliders', []):
                t = s['tested']
                shown = ', '.join(t) if len(t) <= 120 else ', '.join(t[:60]) + f' …（共 {len(t)} 個）… ' + ', '.join(t[-10:])
                L.append(f"- 第 {pg['page']} 頁 `{s['slider']}`：{shown}")
    L += ['', '### 互動／繪圖問題', '']
    L += (['| 頁 | 滑桿 | 值 | 類別 | 原因 |', '|----|------|----|------|------|'] +
          [f"| {r['page']} | {r['slider']} | {r['value']} | {r['kind']} | {r['msg']} |" for r in data['interProblems'][:80]]) if data['interProblems'] else ['無']
    L += ['', '## 3. 公式', '']
    L += (['| 頁 | 滑桿 | 值 | 類別 | 原因 |', '|----|------|----|------|------|'] +
          [f"| {r['page']} | {r['slider']} | {r['value']} | {r['kind']} | {r['msg']} |" for r in data['formulaProblems'][:80]]) if data['formulaProblems'] else ['無 MathJax 錯誤節點、無殘留原始 TeX（只代表排版成功，不代表公式內容正確）']
    L += ['', '## 4. 版面（?check）', '']
    lay = data.get('layout') or {}
    if lay.get('status') in ('通過', '失敗'):
        L.append(f"視窗 {lay['viewport'][0]}×{lay['viewport'][1]}：{lay['status']}" + (f"；有問題的頁：{lay['failPages']}" if lay['failPages'] else ''))
        for p in lay['pages']:
            if p['overflow'] or p['small'] or p['merr'] or p['raw'] or p['failed']:
                L.append(f"- 第 {p['page']} 頁：超出 {p['overflow'] or '無'}；小於 28pt {len(p['small'])} 處；MathJax 錯誤 {p['merr']}；殘留 TeX {p['raw']}")
    else:
        L.append(f"{lay.get('status', '未執行')}：{lay.get('reason', '')}")
    L += ['', '## 4b. 全狀態版面（多種視窗 × 所有互動狀態）', '']
    sts = data.get('states') or {}
    if sts.get('status') in ('通過', '失敗'):
        L.append(f"共量測 {sts['states']} 個畫面狀態：{sts['status']}。放不下就用 `stage` 拆頁（見 `references/lesson-components.md`），不可縮字。")
        L += ['', '| 視窗 | 頁 | 標題 | 狀態 | 視覺欄高／寬超出 px | 概念欄高／寬超出 px | 公式超出 px | 圖中最小字 px |', '|------|----|------|------|------|------|------|------|']
        for r in sts['runs']:
            for q in r['issues'][:150]:
                L.append(f"| {r['viewport'][0]}×{r['viewport'][1]} | {q['page']} | {q['title']} | {q['state']} | {q['vH']}／{q['vW']} | {q['iH']}／{q['iW']} | {q['clip']} | {q['minSvg'] or '—'} |")
    else:
        L.append(f"{sts.get('status', '未執行')}：{sts.get('reason', '')}")
    L += ['', '## 5. 數學內容', '', '**需人工核對**：程式不判定數學是否正確、圖形是否符合題意、公式與圖是否表達同一件事（除非頁面自訂 selfCheck）。驗證通過不代表數學內容正確。', '']
    L += ['## 這份檢查抓不到的問題', '',
          '- 沒有讓程式拋錯、也沒有產生無效數字的數學錯誤（例如公式寫錯、答案錯、圖形比例錯）。',
          '- 不經過 SV 的自寫繪圖（例如自己組 `<text>`、`<rect>` 字串）只能靠 SVG 屬性掃描，無法知道哪一行算錯。',
          '- 退化但數值有限的圖形（三點共線、邊長為 0、直角框方向錯）不會被判為錯誤。',
          '- 多滑桿只測「逐一掃描＋端點組合」，不是全部組合。',
          '- 課堂元件的按鈕會實際點開來量版面，但揭露內容的文字與數學是否正確，仍需人工看一遍。',
          '- 自製的點擊圖形或拖曳互動不在掃描範圍。',
          '- 版面結果只代表量過的視窗；語意問題（拆頁後題目不見、「同一圖」的圖不在同一頁）量不出來，要親眼看截圖。']
    path_md.write_text('\n'.join(L) + '\n', encoding='utf-8')


def main():
    for st in (sys.stdout, sys.stderr):
        try:
            st.reconfigure(encoding='utf-8')
        except Exception:
            pass
    ap = argparse.ArgumentParser(description='課堂簡報兩層檢查（格式＋瀏覽器互動）')
    ap.add_argument('site')
    ap.add_argument('--report-dir')
    ap.add_argument('--window', default='1920x1080')
    ap.add_argument('--cap', type=int, default=2001)
    ap.add_argument('--skip-layout', action='store_true')
    ap.add_argument('--viewports', nargs='+', default=VIEWPORTS)
    ap.add_argument('--browser')
    a = ap.parse_args()

    site = Path(a.site).resolve()
    missing = [f for f in ('index.html', 'engine.js', 'svg.js') if not (site / f).is_file()]
    if missing:
        print(f'❌ site 不完整，缺少：{missing}', file=sys.stderr)
        return 2
    browser = find_browser(a.browser)
    if not browser:
        print('❌ 找不到可用的 Edge 或 Chrome；本工具不會安裝瀏覽器，請用 --browser 指定已安裝的瀏覽器。', file=sys.stderr)
        return 2
    if a.cap < 2:
        print('❌ --cap 至少為 2', file=sys.stderr)
        return 2
    report_dir = Path(a.report_dir).resolve() if a.report_dir else site.parent
    report_dir.mkdir(parents=True, exist_ok=True)

    fmt = format_check(site)
    with tempfile.TemporaryDirectory(prefix='mrd-validate-') as tmp:
        inter, err = interactive_check(site, browser, a.cap, tmp)
        lay = {'status': '略過'} if a.skip_layout else layout_check(site, browser, a.window, tmp)
        sts = {'status': '略過'} if a.skip_layout else states_check(site, browser, a.viewports, tmp)
        hand = handout_check(site, browser, tmp)

    inter_probs, formula_probs = split_problems(inter) if inter else ([], [])
    fatal = inter.get('fatal') if inter else None
    data = {'site': str(site), 'time': datetime.datetime.now().isoformat(timespec='seconds'), 'browser': str(browser),
            'format': fmt, 'interactive': inter, 'interactiveError': err or fatal, 'layout': lay, 'states': sts,
            'interProblems': inter_probs, 'formulaProblems': formula_probs, 'handout': hand}
    sampled = [f"第{p['page']}頁 {s['slider']}" for p in (inter or {}).get('pages', []) for s in p.get('sliders', []) if s['sampled']]
    data['summary'] = {
        '格式（verify_deck.js）': fmt['status'],
        '互動／繪圖（瀏覽器）': ('未完成：' + (err or fatal)) if (err or fatal) else ('通過' if not inter_probs else f'失敗（{len(inter_probs)} 項）') + (f'；⚠ 以下滑桿只抽樣、未測全部合法值：{"、".join(sampled)}' if sampled else ''),
        '公式（MathJax）': '未完成' if (err or fatal) else ('通過（只代表排版成功）' if not formula_probs else f'失敗（{len(formula_probs)} 項）'),
        '版面（?check）': lay.get('status') + (f"（{lay['viewport'][0]}×{lay['viewport'][1]}）" if lay.get('viewport') else ''),
        '全狀態版面（多視窗＋所有互動）': sts['status'] + (f"（{sts['states']} 個狀態，{sts['issues']} 個問題，涉及第 {sts['failPages']} 頁；放不下就拆頁，不可縮字）" if sts['status'] == '失敗' else f"（{sts['states']} 個狀態）" if sts['status'] == '通過' else f"：{sts.get('reason', '')}"),
        '紙本（handout.html）': hand['status'] + (f"：{'；'.join(hand.get('problems', []))}" if hand.get('problems') else f"（任務頁 {hand.get('taskPages', 0)}、出口題 {hand.get('exits', 0)}；列印效果需人工預覽）" if hand['status'] == '通過' else f"：{hand.get('reason', '')}"),
        '數學內容': '需人工核對（程式不判定）',
    }
    md, js = report_dir / 'validation-report.md', report_dir / 'validation-report.json'
    write_report(md, js, data)

    print('📋 課堂簡報驗證')
    for k, v in data['summary'].items():
        print(f'   {k}：{v}')
    for r in (inter_probs + formula_probs)[:12]:
        print(f"   ✗ 第 {r['page']} 頁 {r['slider']} {r['value']}｜{r['kind']}：{r['msg']}")
    print(f'   報告：{md}')
    if err or fatal:
        return 3
    failed = fmt['status'] == '失敗' or inter_probs or formula_probs or lay.get('status') in ('失敗', '未完成') or sts['status'] in ('失敗', '未完成') or hand['status'] in ('失敗', '未完成')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
