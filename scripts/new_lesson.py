#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""new_lesson.py — 產生一節 40 分鐘數學課的互動課堂簡報骨架＋教案草稿（課堂版）。

用法（PowerShell，<技能資料夾> 為本技能安裝位置）：
  python "<技能資料夾>\\scripts\\new_lesson.py" --config "output\\<名稱>\\lesson.json" --out "output\\<名稱>" [--overwrite]

lesson.json（UTF-8）：
  {
    "title": "瀏覽器分頁標題（必填）",
    "grade": "年級（必填）",
    "topic": "課題（必填）",
    "goal": "核心學習目標，寫成可觀察的行為（必填）",
    "prior": "先備知識（選填）",
    "focus": "教學重點（選填）",
    "difficulty": "學習難點（選填）",
    "eyebrow": "封面上方小字（選填，預設為課型名稱）",
    "subtitle": "封面副標（選填，預設為核心學習目標）",
    "description": "meta description（選填）",
    "phases": [ ...（選填；不寫就用本技能 assets/phases.json 的預設五階段）... ]
  }
  phases 每項：{"time": "0–5 分鐘", "title": "階段名稱", "color": "#RRGGBB（選填）",
               "sections": [{"code": "1-1", "name": "節名", "kind": "元件種類"}]}
  kind 可用：goals、tasks、check、mistake、timer、exit、tally、slider、stepper、static
  各階段時間必須從 0 分鐘開始、首尾相接、總長 40 分鐘。未定義的欄位一律報錯。

產出（--out 資料夾內）：
  site\\        index.html、engine.js、style.css、projection.css、svg.js、lesson.js、lesson.css、
               ch1.js…chN.js（一個階段一個檔）、mathjax\\（MathJax 3.2.2）
  lesson-plan.md  教案草稿（依 AGENTS 標準格式 A～F 與品質檢查表）

覆寫規則：任何一個產出檔已存在就停止（代碼 3）。加 --overwrite 只覆寫產出檔，不刪除其他檔案。

MathJax 來源（依序找第一個存在的）：
  1. 環境變數 MATH_LESSON_MATHJAX（指向 mathjax 套件資料夾）
  2. 本技能的 vendor\\mathjax（Repo 內附，正常安裝就有）
  3. %USERPROFILE%\\.claude\\tools\\math-review-runtime\\node_modules\\mathjax
  版本必須是 3.2.2，入口檔雜湊值必須相符。

結束代碼：0 成功｜2 設定錯誤｜3 產出檔已存在｜4 MathJax 來源缺少或不符
不安裝任何套件、不連網、不做 Git 或部署。
"""
import argparse
import datetime
import hashlib
import html
import json
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, 'assets')
ASSET_FILES = ('engine.js', 'style.css', 'projection.css', 'svg.js', 'lesson.js', 'lesson.css')

MATHJAX_VERSION = '3.2.2'
MATHJAX_ENTRY_SHA256 = 'a4354ff94fd868aea0cc6eaaa79a57fda0588646fc46ee3700a349ee0a11cbe6'
MATHJAX_FILES = ('LICENSE', 'package.json', 'README.md', os.path.join('es5', 'tex-svg-full.js'))
MATHJAX_DIRS = ('a11y', 'adaptors', 'input', 'output', 'sre', 'ui')

PALETTE = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#e11d48', '#0891b2']
TOP_KEYS = {'title', 'grade', 'topic', 'goal', 'prior', 'focus', 'difficulty',
            'eyebrow', 'subtitle', 'description', 'phases'}
PHASE_KEYS = {'time', 'title', 'color', 'sections'}
SEC_KEYS = {'code', 'name', 'kind'}
LESSON_MINUTES = 40

EXIT_CONFIG, EXIT_EXISTS, EXIT_MATHJAX = 2, 3, 4


def js_str(s):
    """JavaScript 字串字面值（雙引號，跳脫引號、反斜線、換行及 </）。"""
    return json.dumps(s, ensure_ascii=False).replace('</', '<\\/')


def js_html(s):
    """會被 engine.js 以 innerHTML 插入的純文字：先做 HTML 跳脫，再轉成 JS 字串。"""
    return js_str(html.escape(s, quote=True))


def comment_safe(s):
    return s.replace('*/', '* /')


def md_cell(s):
    return str(s).replace('|', '｜').replace('\n', ' ')


CH_TEMPLATE = '''/* ============ 第 %(ch)d 階段　%(time_c)s　%(title_c)s ============
   課型：%(type_c)s
   本階段小節：%(seclist_c)s
   範圍邊界：（請填「本節課刻意不教」的內容，避免超出範圍）
   投影提醒：points 每頁 ≤3 條、每條約 ≤24 字；右欄元件內容一次只顯示一層，用按鈕逐步揭露。
   ============================================================ */
window.DECK = window.DECK || [];
(function () {
  const C = %(color)s;
  const RED = '#e11d48', GRN = '#059669', BLU = '#2563eb', VIO = '#7c3aed', AMB = '#d97706';

  // 標準 SVG 包裝：圖會自適應欄寬（圖中文字的實際大小隨欄寬改變）
  function svg(vb, inner) {
    return `<div style="width:100%%;text-align:center"><svg viewBox="${vb}" style="max-width:100%%">${inner}</svg></div>`;
  }
  const TX = (x, y, s, o = {}) =>
    `<text x="${x}" y="${y}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} font-size="${o.fs || 26}" font-weight="${o.fw || 800}" fill="${o.c || '#172033'}">${s}</text>`;

  window.DECK.push({
    ch: %(ch)d,
    time: %(time)s,
    title: %(title)s,
    color: C,
    sections: %(sections)s,
    slides: [

      %(slides)s
    ]
  });
})();
'''

HEAD = '''{
        sec: %(sec)s, secName: %(secname)s,'''

SLIDES = {
    'goals': HEAD + '''
        title: '請填：本節學完能做到什麼',
        points: ['請填：學生現在要做什麼（≤24 字）。'],
        visual: (h) => LS.goals(h, { head: '本節學習目標', items: ['請填：可觀察的目標一。', '請填：目標二。'] })
      }''',
    'tasks': HEAD + '''
        title: '請填：本頁任務重點',
        points: ['先獨立做，卡住再按「給提示」。', '完成 B 層的同學挑戰 C 層。'],
        visual: (h) => LS.tasks(h, [
          { tier: 'A', q: '請填：A 層基礎支持題（附提示）。', hints: ['請填：提示 1（重讀題目）。', '請填：提示 2（相關概念）。'], ans: '請填' },
          { tier: 'B', q: '請填：B 層核心達標題。', hints: ['請填：提示。'], ans: '請填' },
          { tier: 'C', q: '請填：C 層延伸挑戰題（解釋、比較或遷移）。', ans: '請填' }
        ], { start: 'B' })
      }''',
    'check': HEAD + '''
        title: '請填：理解檢查的問題',
        points: ['全班同時用手勢或小白板作答。', '老師點選項計票，再揭曉。'],
        visual: (h) => LS.check(h, {
          q: '請填：能揭示理解程度的問題。',
          options: [
            { t: '請填：正確選項', ok: true, why: '請填：為什麼對。' },
            { t: '請填：典型錯誤一', why: '請填：反映哪種迷思。' },
            { t: '請填：典型錯誤二', why: '請填：反映哪種迷思。' }
          ]
        })
      }''',
    'mistake': HEAD + '''
        title: '請填：這個錯誤從哪一步開始？',
        points: ['這個解法哪一步開始出現問題？', '怎樣檢查答案是否合理？'],
        visual: (h) => LS.mistake(h, {
          q: '請填：題目。',
          steps: ['請填：第 1 步。', '請填：第 2 步（錯誤步驟）。', '請填：第 3 步。'],
          wrong: 1,
          why: '請填：錯誤成因（概念／程序／粗心）。',
          fix: '請填：正確做法。'
        })
      }''',
    'timer': HEAD + '''
        title: '請填：獨立嘗試，老師巡視',
        points: ['先自己想，再動筆。', '卡住時舉手，老師先給提示。'],
        visual: (h) => LS.timer(h, { min: 8, label: '獨立練習', tips: ['請填：巡視觀察重點。'] })
      }''',
    'exit': HEAD + '''
        title: '請填：出口題',
        points: ['獨立完成，約 2～3 分鐘。', '寫出關鍵步驟。'],
        visual: (h) => LS.exit(h, {
          q: '請填：與核心目標直接相關的出口題。',
          ans: '請填',
          rubric: {
            mastered: '請填：判準 → 下一節安排。',
            partial: '請填：判準 → 下一節安排。',
            notyet: '請填：判準 → 下一節安排。'
          }
        })
      }''',
    'tally': HEAD + '''
        title: '請填：自我評估',
        points: ['舉手表示自己的程度。', '誠實回答，下一節依此安排。'],
        visual: (h) => LS.tally(h, { q: '請填：我能……', levels: ['已掌握', '部分掌握', '尚未掌握'] })
      }''',
    'static': HEAD + '''
        title: '請填：本頁唯一重點',
        points: ['重點一（≤24 字）。', '重點二。'],
        formula: { label: '公式', tex: 'a^2+b^2=c^2' },
        visual: (h) => {
          h.innerHTML = svg('0 0 440 280', TX(220, 150, '請畫圖', { fs: 30, c: C, anchor: 'middle' }));
        },
        caption: '圖說一行。',
        example: { q: '請填題目。', steps: ['第一步。', '第二步。'], ans: '答案' }
      }''',
    'slider': HEAD + '''
        title: '請填：拖滑桿觀察什麼？',
        points: ['先猜：a 變大時會怎樣？', '拖滑桿驗證你的猜測。'],
        formula: { label: '公式', tex: 'y=ax' },
        visual: (h) => {
          h.innerHTML = `<div style="width:100%%"><div class="fig"></div>
            <div class="ictrl"><label>a ＝ <span class="ival av">2</span></label>
            <input type="range" id="as" min="1" max="6" step="1" value="2"></div></div>`;
          const draw = () => {
            const a = +h.querySelector('#as').value;
            h.querySelector('.av').textContent = a;
            let s = TX(220, 44, `a = ${a}`, { fs: 30, c: C, anchor: 'middle' });
            s += `<rect x="80" y="80" width="${45 * a}" height="110" rx="12" fill="rgba(37,99,235,.12)" stroke="${C}" stroke-width="2"/>`;
            h.querySelector('.fig').innerHTML = svg('0 0 440 280', s);
          };
          h.querySelector('#as').oninput = draw; draw();
        },
        caption: '圖說一行。'
      }''',
    'stepper': HEAD + '''
        title: '請填：示範例題的關鍵步驟',
        points: ['每一步都說出「為什麼可以這樣做」。'],
        visual: (h) => {
          SV.stepper(h, '0 0 440 280', [
            { t: '請填：第 1 步說明', d: k => TX(220, 120, '步驟 1', { fs: 30, c: C, anchor: 'middle' }) },
            { t: '請填：第 2 步說明', d: k => TX(220, 190, '步驟 2', { fs: 30, c: GRN, anchor: 'middle' }) }
          ]);
        },
        example: { q: '請填：示範例題。', steps: ['第一步。', '第二步。'], ans: '答案' }
      }''',
}

TIME_RE = re.compile(r'^\s*(\d+)\s*[–\-~～至]\s*(\d+)\s*分(鐘)?\s*$')


def fail(code, msgs):
    if isinstance(msgs, str):
        msgs = [msgs]
    print('❌ ' + msgs[0], file=sys.stderr)
    for m in msgs[1:]:
        print('   - ' + m, file=sys.stderr)
    sys.exit(code)


def load_json(path, what):
    try:
        with open(path, encoding='utf-8-sig') as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as e:
        fail(EXIT_CONFIG, f'無法讀取{what} {path}：{e}')


def load_config(path):
    cfg = load_json(path, '設定檔')
    preset = load_json(os.path.join(ASSETS, 'phases.json'), '本技能的 phases.json')
    errs = []
    if not isinstance(cfg, dict):
        fail(EXIT_CONFIG, '設定檔最外層必須是物件')
    for k in sorted(set(cfg) - TOP_KEYS):
        errs.append(f'未定義的欄位「{k}」')
    for k in ('title', 'grade', 'topic', 'goal'):
        if not isinstance(cfg.get(k), str) or not cfg[k].strip():
            errs.append(f'{k} 必填（非空字串）')
    for k in ('prior', 'focus', 'difficulty', 'eyebrow', 'subtitle', 'description'):
        if k in cfg and not isinstance(cfg[k], str):
            errs.append(f'{k} 必須是字串')
    phases = cfg.get('phases', preset['phases'])
    if not isinstance(phases, list) or not phases:
        errs.append('phases 必須是非空陣列')
        phases = []
    clock, colors, codes = 0, {}, {}
    for i, ph in enumerate(phases, start=1):
        w = f'phases[{i - 1}]'
        if not isinstance(ph, dict):
            errs.append(f'{w} 必須是物件')
            continue
        for k in sorted(set(ph) - PHASE_KEYS):
            errs.append(f'{w} 有未定義的欄位「{k}」')
        if not isinstance(ph.get('title'), str) or not ph['title'].strip():
            errs.append(f'{w}.title 必填')
        m = TIME_RE.match(str(ph.get('time', '')))
        if not m:
            errs.append(f'{w}.time 格式應為「0–5 分鐘」')
        else:
            a, b = int(m.group(1)), int(m.group(2))
            if a != clock or b <= a:
                errs.append(f'{w}.time「{ph["time"]}」應從第 {clock} 分鐘開始，且結束時間大於開始時間')
            clock = b
        color = ph.get('color') or PALETTE[(i - 1) % len(PALETTE)]
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', str(color)):
            errs.append(f'{w}.color 必須是 #RRGGBB')
        elif color.lower() in colors:
            errs.append(f'{w}.color {color} 與第 {colors[color.lower()]} 階段重複')
        else:
            colors[color.lower()] = i
        ph['_color'] = color
        secs = ph.get('sections')
        if not isinstance(secs, list) or not secs:
            errs.append(f'{w}.sections 必填（非空陣列）')
            continue
        for j, s in enumerate(secs):
            ws = f'{w}.sections[{j}]'
            if not isinstance(s, dict):
                errs.append(f'{ws} 必須是物件 {{code, name, kind}}')
                continue
            for k in sorted(set(s) - SEC_KEYS):
                errs.append(f'{ws} 有未定義的欄位「{k}」')
            code, name, kind = s.get('code'), s.get('name'), s.get('kind')
            if not isinstance(code, str) or not re.fullmatch(r'\S+', code or ''):
                errs.append(f'{ws}.code 必填，不可含空白（例：1-1）')
            elif code in codes:
                errs.append(f'小節代碼「{code}」重複（第 {codes[code]} 與第 {i} 階段）')
            else:
                codes[code] = i
            if not isinstance(name, str) or not name.strip():
                errs.append(f'{ws}.name 必填')
            if kind not in SLIDES:
                errs.append(f'{ws}.kind「{kind}」不支援，可用：{"、".join(SLIDES)}')
    if phases and clock != LESSON_MINUTES:
        errs.append(f'各階段總長為 {clock} 分鐘，應為 {LESSON_MINUTES} 分鐘')
    if errs:
        fail(EXIT_CONFIG, ['設定檔有誤，未產生任何檔案：'] + errs)
    cfg['_phases'] = phases
    cfg['_type'] = preset['type_name']
    return cfg


def mathjax_source():
    home_rt = os.path.join(os.path.expanduser('~'), '.claude', 'tools', 'math-review-runtime', 'node_modules', 'mathjax')
    cands = [os.environ.get('MATH_LESSON_MATHJAX'), os.path.join(ROOT, 'vendor', 'mathjax'), home_rt]
    src = next((c for c in cands if c and os.path.isfile(os.path.join(c, 'package.json'))), None)
    if not src:
        fail(EXIT_MATHJAX, ['找不到 MathJax 來源；本腳本不會自動安裝。已找過：'] + [c for c in cands if c])
    try:
        with open(os.path.join(src, 'package.json'), encoding='utf-8') as fh:
            ver = json.load(fh).get('version')
        with open(os.path.join(src, 'es5', 'tex-svg-full.js'), 'rb') as fh:
            digest = hashlib.sha256(fh.read()).hexdigest()
    except OSError as e:
        fail(EXIT_MATHJAX, f'MathJax 來源不完整（{src}）：{e}')
    if ver != MATHJAX_VERSION or digest != MATHJAX_ENTRY_SHA256:
        fail(EXIT_MATHJAX, f'MathJax 來源不符（{src}）：版本 {ver}、入口檔 SHA256 {digest[:12]}…（應為 {MATHJAX_VERSION}、{MATHJAX_ENTRY_SHA256[:12]}…）')
    missing = [d for d in MATHJAX_DIRS if not os.path.isdir(os.path.join(src, 'es5', d))]
    missing += [f for f in MATHJAX_FILES if not os.path.isfile(os.path.join(src, f))]
    if missing:
        fail(EXIT_MATHJAX, f'MathJax 來源缺少：{missing}')
    files = list(MATHJAX_FILES)
    for d in MATHJAX_DIRS:
        for base, _, names in os.walk(os.path.join(src, 'es5', d)):
            for n in names:
                files.append(os.path.relpath(os.path.join(base, n), src))
    return src, sorted(files)


def lesson_plan(cfg):
    p = cfg['_phases']
    L = [f"# {cfg['title']}", '',
         f"> 課型：{cfg['_type']}｜由 new_lesson.py 產生的教案草稿。「請填」處由 Agent 依教師提供的資料補上；"
         '沒有真實課堂資料時，學生表現一律標註「預期情況」，不得虛構。', '',
         '## A. 課堂基本資料', '',
         f"- 年級：{cfg['grade']}", f"- 課題：{cfg['topic']}", f'- 課時：{LESSON_MINUTES}分鐘',
         f"- 核心學習目標：{cfg['goal']}", f"- 先備知識：{cfg.get('prior') or '請填'}",
         f"- 教學重點：{cfg.get('focus') or '請填'}", f"- 學習難點：{cfg.get('difficulty') or '請填'}", '',
         f'## B. {LESSON_MINUTES}分鐘教學流程表', '',
         '| 時間 | 階段 | 教師活動 | 學生活動 | 分層支持 | 學習證據 | 對應投影片 |',
         '|------|------|----------|----------|----------|----------|------------|']
    for i, ph in enumerate(p, start=1):
        secs = '、'.join(f"{s['code']} {s['name']}" for s in ph['sections'])
        L.append(f"| {md_cell(ph['time'])} | {md_cell(ph['title'])} | 請填 | 請填 | 請填 | 請填 | 第 {i} 階段：{md_cell(secs)} |")
    L += ['', '各階段另列：教學資源、理解檢查、可能困難、應對策略。', '']
    for i, ph in enumerate(p, start=1):
        L += [f"### 第 {i} 階段　{ph['time']}　{ph['title']}", '',
              '- 教師活動：請填', '- 學生活動：請填', '- 教學資源：請填', '- 理解檢查：請填',
              '- 可能困難：請填', '- 應對策略：請填', '']
    L += ['## C. 課堂練習', '',
          '| 層次 | 題目 | 答案 | 解題說明／提示 |', '|------|------|------|----------------|',
          '| A層 基礎支持 | 請填 | 請填 | 請填 |', '| B層 核心達標 | 請填 | 請填 | 請填 |', '| C層 延伸挑戰 | 請填 | 請填 | 請填 |', '',
          '## D. 典型錯誤分析', '',
          '- 錯誤示例：請填', '- 可能原因（概念／程序／粗心）：請填', '- 診斷問題：請填',
          '- 教師引導方式：請填', '- 修正後練習：請填', '',
          '## E. 出口題及評估', '',
          '- 出口題：請填', '- 參考答案：請填', '- 達標判準：已掌握／部分掌握／尚未掌握 各一句', '',
          '| 結果 | 判準 | 下一節課安排 |', '|------|------|--------------|',
          '| 已掌握 | 請填 | 請填 |', '| 部分掌握 | 請填 | 請填 |', '| 尚未掌握 | 請填 | 請填 |', '',
          '## F. 課後反思（上課後由教師依真實證據填寫）', '',
          '- 本節課最有效的設計：', '- 學生最常見的困難：', '- 需要個別跟進的學生：', '- 下一節課的調整：', '',
          '## 教案品質檢查', '',
          '- [ ] 是否具有明確、可觀察的學習目標？',
          f'- [ ] 各教學階段的總時間是否為{LESSON_MINUTES}分鐘？',
          '- [ ] 是否讓不同程度學生都有明確任務？',
          '- [ ] 是否設計至少兩個理解檢查點？',
          '- [ ] 是否安排學生獨立思考及解題？',
          '- [ ] 是否預測典型數學錯誤？',
          '- [ ] 是否提供分層支持？',
          '- [ ] 是否包含有效的出口題？',
          '- [ ] 是否說明如何利用學習證據調整教學？',
          '- [ ] 是否考慮教師實際工作量及課堂可行性？', '']
    return '\n'.join(L)


def build(cfg, version):
    """回傳 {相對路徑: 內容字串}（不含 MathJax）。路徑以 --out 為基準。"""
    out = {}
    for f in ASSET_FILES:
        with open(os.path.join(ASSETS, f), encoding='utf-8') as fh:
            out[os.path.join('site', f)] = fh.read()
    for i, ph in enumerate(cfg['_phases'], start=1):
        slides = [SLIDES[s['kind']] % {'sec': js_html(s['code']), 'secname': js_html(s['name'])} for s in ph['sections']]
        labels = [f"{s['code']} {s['name']}" for s in ph['sections']]
        out[os.path.join('site', f'ch{i}.js')] = CH_TEMPLATE % {
            'ch': i,
            'time_c': comment_safe(ph['time']),
            'title_c': comment_safe(ph['title']),
            'type_c': comment_safe(cfg['_type']),
            'seclist_c': comment_safe('、'.join(labels)),
            'color': js_str(ph['_color']),
            'time': js_html(ph['time']),
            'title': js_html(ph['title']),
            'sections': '[' + ', '.join(js_html(x) for x in labels) + ']',
            'slides': ',\n\n      '.join(slides),
        }
    with open(os.path.join(ASSETS, 'index.template.html'), encoding='utf-8') as fh:
        tpl = fh.read()
    e = lambda s: html.escape(s, quote=True)
    scripts = '\n'.join(f'  <script src="ch{i}.js?v={version}"></script>' for i in range(1, len(cfg['_phases']) + 1))
    out[os.path.join('site', 'index.html')] = (tpl.replace('{{TITLE}}', e(cfg['title']))
                                               .replace('{{DESCRIPTION}}', e(cfg.get('description') or cfg['title']))
                                               .replace('{{EYEBROW}}', e(cfg.get('eyebrow') or f"{cfg['grade']}｜{cfg['_type']}"))
                                               .replace('{{COVER_TITLE}}', e(cfg['topic']))
                                               .replace('{{COVER_SUB}}', e(cfg.get('subtitle') or cfg['goal']))
                                               .replace('{{HOME_LABEL}}', e(cfg['_type']))
                                               .replace('{{VERSION}}', version)
                                               .replace('{{CHAPTER_SCRIPTS}}', scripts))
    out['lesson-plan.md'] = lesson_plan(cfg)
    return out


def write_atomic(path, data, binary=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.tmp-')
    try:
        with os.fdopen(fd, 'wb' if binary else 'w', **({} if binary else {'encoding': 'utf-8', 'newline': '\n'})) as fh:
            fh.write(data)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8')
        except Exception:
            pass
    p = argparse.ArgumentParser(description='產生 40 分鐘數學課互動簡報骨架＋教案草稿')
    p.add_argument('--config', required=True, help='lesson.json 設定檔')
    p.add_argument('--out', required=True, help='輸出資料夾（內含 site\\ 與 lesson-plan.md）')
    p.add_argument('--overwrite', action='store_true', help='只覆寫本腳本的產出檔，不刪除其他檔案')
    a = p.parse_args()

    cfg = load_config(a.config)
    src, mj_files = mathjax_source()
    version = datetime.date.today().strftime('%Y%m%d')
    files = build(cfg, version)

    out = os.path.abspath(a.out)
    targets = list(files) + [os.path.join('site', 'mathjax', f) for f in mj_files]
    existing = [t for t in targets if os.path.exists(os.path.join(out, t))]
    if existing and not a.overwrite:
        shown = existing[:12] + ([f'…另 {len(existing) - 12} 個'] if len(existing) > 12 else [])
        fail(EXIT_EXISTS, ['以下產出檔已存在，未寫入任何檔案（確定要覆寫請加 --overwrite；只會覆寫這些檔案）：'] + shown)

    for rel, text in files.items():
        write_atomic(os.path.join(out, rel), text)
    for f in mj_files:
        with open(os.path.join(src, f), 'rb') as fh:
            write_atomic(os.path.join(out, 'site', 'mathjax', f), fh.read(), binary=True)

    n = sum(len(ph['sections']) for ph in cfg['_phases'])
    print(f'✅ 已建立 {out}')
    print(f"   課型：{cfg['_type']}；{len(cfg['_phases'])} 個階段、{n} 張骨架頁；資源版本號 ?v={version}")
    print(f'   教案草稿：{os.path.join(out, "lesson-plan.md")}')
    print(f'   MathJax {MATHJAX_VERSION}：已從 {src} 複製 {len(mj_files)} 個檔案')
    if existing:
        print(f'   已覆寫 {len(existing)} 個既有產出檔；資料夾內其他檔案未變動')
    print('下一步：填寫 site\\chN.js 與 lesson-plan.md → 執行 scripts\\validate_deck.py 檢查')


if __name__ == '__main__':
    main()
