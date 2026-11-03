#!/usr/bin/env node
/*
 * verify_deck.js — 離線檢查一份互動複習簡報。
 *
 *   node scripts/verify_deck.js <簡報資料夾> [--forbid 詞1,詞2] [--quiet]
 *
 * 不需要瀏覽器：用 stub 把每一張投影片的 visual() 實際執行一遍，
 * 並掃過每一個滑桿的每一個值，因此能抓出「只有拖到某個值才會爆」的錯誤。
 *
 * 檢查項目
 *   [語法]   每個 chN.js 能否被 JS 剖析
 *   [結構]   ch / color / sections 是否齊全；每頁必要欄位 sec/secName/title/points/visual
 *   [執行]   visual() 是否拋錯、是否產生空白內容；滑桿掃過每個值是否拋錯
 *   [版面]   SVG viewBox 寬高比 ≥1.35、高度 ≤320（含滑桿 ≤300）
 *   [文字]   points 條數 ≤4、單條長度、\( \) 是否成對、formula.tex 內誤寫 $$
 *   [規範]   visual 內禁用 document.getElementById（跨頁 id 會打架）
 *   [載入]   index.html 的 chN.js 標籤與實際檔案是否一致、?v= 版本號是否一致
 *   [超綱]   --forbid 指定的詞若出現在投影片文字中就報警
 *   [課堂版] 若資料夾有 lesson.js，先載入讓 LS 課堂元件可執行；LS 元件頁計入互動頁
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const quiet = args.includes('--quiet');
const forbidArg = (() => {
  const i = args.indexOf('--forbid');
  return i >= 0 && args[i + 1] ? args[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : [];
})();

if (!dir) {
  console.error('用法：node scripts/verify_deck.js <簡報資料夾> [--forbid 詞1,詞2] [--quiet]');
  process.exit(2);
}
if (!fs.existsSync(dir)) {
  console.error('找不到資料夾：' + dir);
  process.exit(2);
}

const errors = [];
const warns = [];
const info = [];
const _seen = new Set();
const err = (m) => { if (!_seen.has('E'+m)) { _seen.add('E'+m); errors.push(m); } };
const warn = (m) => { if (!_seen.has('W'+m)) { _seen.add('W'+m); warns.push(m); } };

/* ---------- 極簡 DOM stub：夠讓 visual() 跑起來 ---------- */
function makeEl() {
  const el = {
    innerHTML: '',
    textContent: '',
    value: '0',
    min: '0',
    max: '1',
    step: '1',
    style: {},
    dataset: {},
    oninput: null,
    onclick: null,
    _kids: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return null; },
    appendChild() {},
    addEventListener() {},
    querySelector(sel) { return el._kids[sel] || (el._kids[sel] = makeEl()); },
    querySelectorAll() { return []; },
  };
  return el;
}
// host：所有被 innerHTML 寫入的字串都累積起來，供後續版面檢查
function makeHost() {
  const h = makeEl();
  h._all = [];
  let raw = '';
  Object.defineProperty(h, 'innerHTML', {
    get() { return raw; },
    set(v) { raw = String(v); h._all.push(raw); },
  });
  const origQS = h.querySelector.bind(h);
  h.querySelector = (sel) => {
    const kid = origQS(sel);
    if (!kid._patched) {
      kid._patched = true;
      let kraw = '';
      Object.defineProperty(kid, 'innerHTML', {
        get() { return kraw; },
        set(v) { kraw = String(v); h._all.push(kraw); },
      });
    }
    return kid;
  };
  return h;
}

/* ---------- SV stub（與 assets/svg.js 的 API 對齊） ---------- */
const RAD = Math.PI / 180;
const SVstub = {
  RAD,
  pt: (cx, cy, r, d) => [cx + r * Math.cos(d * RAD), cy - r * Math.sin(d * RAD)],
  angleOf: (cx, cy, x, y) => ((Math.atan2(-(y - cy), x - cx) / RAD) + 360) % 360,
  arcPoints: () => '0,0 1,1',
  angle: () => '<polyline points="0,0"/>',
  rightAngle: () => '<path d="M0,0"/>',
  ticks: () => '<line x1="0" y1="0" x2="1" y2="1"/>',
  dot: (x, y, c, r) => `<circle cx="${x}" cy="${y}" r="${r || 4.5}" fill="${c || '#000'}"/>`,
  vlabel: (x, y, t) => `<text x="${x}" y="${y}">${t}</text>`,
  seg: (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`,
  poly: (pts) => `<polygon points="${(pts || []).map((p) => p.join(',')).join(' ')}"/>`,
  arrowDefs: () => '<defs></defs>',
  plane: (o) => {
    const { x0 = 60, y0 = 40, w = 420, h = 360, xmin = -6, xmax = 6, ymin = -6, ymax = 6 } = o || {};
    const sx = w / (xmax - xmin), sy = h / (ymax - ymin);
    return { svg: '<g></g>', defs: '<defs></defs>', X: (m) => x0 + (m - xmin) * sx, Y: (m) => y0 + (ymax - m) * sy };
  },
  fbox: (rows) => `<div>${(rows || []).map((r) => `<div>${r.label || ''} ${r.tex || ''} ${r.note || ''}</div>`).join('')}</div>`,
  // stepper：實際呼叫每一步的 d(k)，讓步驟裡的錯誤浮現
  stepper: (h, vb, steps, opt) => {
    h.innerHTML = `<div><svg viewBox="${vb}"><g class="stepg"></g></svg><div class="ictrl"><input type="range"></div></div>`;
    (steps || []).forEach((st) => {
      if (typeof st.d === 'function') { st.d(0); st.d(0.5); st.d(1); }
    });
  },
};

/* ---------- 逐檔載入 ---------- */
const chFiles = fs.readdirSync(dir).filter((f) => /^ch\d+\.js$/.test(f))
  .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

if (!chFiles.length) err('資料夾內找不到任何 chN.js');

for (const f of ['engine.js', 'style.css', 'svg.js', 'index.html']) {
  if (!fs.existsSync(path.join(dir, f))) err(`缺少必要檔案 ${f}`);
}

const sandbox = { window: {}, SV: SVstub, MJ: () => {}, console, Math, Date, JSON, String, Number, Array, Object, setInterval: () => 0, clearInterval: () => {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// [課堂版] 先載入 lesson.js（課堂元件 LS），讓 visual() 內的 LS.xxx 可以在 stub 中執行
if (fs.existsSync(path.join(dir, 'lesson.js'))) {
  try {
    vm.runInContext(fs.readFileSync(path.join(dir, 'lesson.js'), 'utf8'), sandbox, { filename: 'lesson.js' });
    sandbox.LS = sandbox.window.LS;
  } catch (e) { err(`lesson.js：載入失敗 → ${e.message}`); }
}

const srcByFile = {};
for (const f of chFiles) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  srcByFile[f] = src;

  // 只抓「真正的呼叫」（帶左括號），避免說明文字提到這個名稱時誤判
  if (/document\.getElementById\s*\(/.test(src)) {
    err(`${f}：使用了 document.getElementById（跨頁 id 會互相打架，請改用 h.querySelector）`);
  }
  const texMatches = src.match(/tex:\s*'([^']*)'/g) || [];
  texMatches.forEach((m) => { if (m.includes('$$')) err(`${f}：formula.tex 內出現 $$（引擎會自動包，勿重複）`); });

  try {
    vm.runInContext(src, sandbox, { filename: f });
  } catch (e) {
    err(`${f}：載入失敗 → ${e.message}`);
  }
}

const DECK = sandbox.window.DECK || [];
if (!DECK.length) err('window.DECK 是空的——章節檔沒有成功 push');

/* ---------- 逐章逐頁檢查 ---------- */
let slideCount = 0, interactive = 0, withExample = 0;
const seenColors = new Map();

DECK.forEach((chap, ci) => {
  const where = `第 ${chap.ch} 章「${chap.title}」`;
  if (typeof chap.ch !== 'number') err(`${where}：缺少數字型 ch`);
  if (!chap.title) err(`${where}：缺少 title`);
  if (!/^#[0-9a-fA-F]{6}$/.test(chap.color || '')) err(`${where}：color 不是合法色碼`);
  if (!Array.isArray(chap.sections) || !chap.sections.length) err(`${where}：sections 缺少或為空`);
  if (chap.color) {
    if (seenColors.has(chap.color)) warn(`${where}：章色 ${chap.color} 與「${seenColors.get(chap.color)}」重複`);
    else seenColors.set(chap.color, chap.title);
  }
  if (!Array.isArray(chap.slides) || !chap.slides.length) { err(`${where}：slides 缺少或為空`); return; }

  const secsInChapter = new Set();
  chap.slides.forEach((s, si) => {
    slideCount++;
    const tag = `${where} 第 ${si + 1} 頁「${String(s.title || '(無標題)').replace(/<[^>]*>/g, '').slice(0, 22)}」`;

    ['sec', 'secName', 'title', 'points', 'visual'].forEach((k) => {
      if (s[k] === undefined || s[k] === null || s[k] === '') err(`${tag}：缺少必要欄位 ${k}`);
    });
    if (s.sec) secsInChapter.add(s.sec);

    if (Array.isArray(s.points)) {
      if (s.points.length > 4) warn(`${tag}：points 有 ${s.points.length} 條（建議 ≤4，過多會擠）`);
      s.points.forEach((p, pi) => {
        const plain = String(p).replace(/<[^>]*>/g, '').replace(/\\\\?\(|\\\\?\)/g, '')
          .replace(/\\[a-zA-Z]+\s*/g, '').replace(/[{}]/g, '');
        if (plain.length > 52) warn(`${tag}：points[${pi}] 約 ${plain.length} 字（建議 ≤45）`);
      });
    }
    if (s.example) withExample++;
    if (s.example && Array.isArray(s.example.steps) && s.example.steps.length > 4) {
      warn(`${tag}：example.steps 有 ${s.example.steps.length} 步（建議 ≤4）`);
    }

    // \( \) 成對
    const joined = [s.title, ...(s.points || []), s.caption || '',
      s.example ? s.example.q : '', s.example ? (s.example.steps || []).join(' ') : '',
      s.example ? s.example.ans || '' : ''].join(' ');
    const open = (joined.match(/\\\(/g) || []).length;
    const close = (joined.match(/\\\)/g) || []).length;
    if (open !== close) err(`${tag}：行內數學 \\( 有 ${open} 個、\\) 有 ${close} 個，不成對`);

    // 超綱字詞
    forbidArg.forEach((w) => {
      if (joined.includes(w)) err(`${tag}：出現禁用詞「${w}」（超出指定範圍）`);
    });

    // 執行 visual()
    if (typeof s.visual === 'function') {
      const h = makeHost();
      // 第一次繪製：此時 stub 還不知道各滑桿的初始值，可能餵到不合理的數字，
      // 因此先「暫記」錯誤，等用真正的 value 重跑成功就不算數。
      let firstErr = null;
      try { s.visual(h); } catch (e) { firstErr = e.message; }

      let html = h._all.join('');
      if (!html.trim() && firstErr) { err(`${tag}：visual() 執行錯誤 → ${firstErr}`); return; }
      if (!html.trim()) { err(`${tag}：visual() 沒有產生任何內容`); return; }

      const hasCtrl = /class="ictrl"/.test(html) || /SV\.stepper/.test(String(s.visual));
      const hasLesson = /LS\.(tasks|check|mistake|timer|exit|tally)\s*\(/.test(String(s.visual));   // [課堂版] 課堂元件也算互動

      // 從產生的 HTML 解析每個 <input type=range> 的 id/min/max/step/value（不依賴屬性順序）
      const inputs = [...html.matchAll(/<input\b[^>]*>/g)].map((m) => m[0])
        .filter((t) => /type="range"/.test(t))
        .map((t) => {
          const attr = (n) => { const r = t.match(new RegExp(n + '="([^"]*)"')); return r ? r[1] : null; };
          return { id: attr('id'), min: parseFloat(attr('min')), max: parseFloat(attr('max')),
                   step: parseFloat(attr('step')) || 1, value: attr('value') };
        })
        .filter((o) => o.id && isFinite(o.min) && isFinite(o.max));

      const sliderKeys = Object.keys(h._kids || {}).filter((k) => h._kids[k] && h._kids[k].oninput);
      let sweepFailed = null;

      inputs.forEach((sp) => {
        const el = h._kids['#' + sp.id];
        if (!el || !el.oninput) return;
        // 先用宣告的初始值重跑一次
        if (sp.value !== null) {
          el.value = sp.value;
          try { el.oninput(); } catch (e) { sweepFailed = sweepFailed || `初始值 ${sp.value} → ${e.message}`; }
        }
        const steps = Math.min(80, Math.max(1, Math.round((sp.max - sp.min) / sp.step)));
        for (let i = 0; i <= steps; i++) {
          const v = sp.min + i * sp.step;
          el.value = String(Math.abs(v) < 1e-9 ? 0 : +v.toFixed(6));
          try { el.oninput(); } catch (e) {
            err(`${tag}：滑桿 #${sp.id} 在值 ${el.value} 時出錯 → ${e.message}`);
            sweepFailed = sweepFailed || e.message;
            break;
          }
        }
      });

      // 初次繪製失敗，但用真正的值重跑都沒事 → 判定為 stub 取值造成，不報錯
      if (firstErr && inputs.length && !sweepFailed) {
        info.push(`（略過 stub 假警報：${tag} 初次繪製 ${firstErr}）`);
      } else if (firstErr && !inputs.length) {
        err(`${tag}：visual() 執行錯誤 → ${firstErr}`);
      }

      if (hasCtrl || sliderKeys.length || hasLesson) interactive++;
      if (inputs.length > 2) warn(`${tag}：有 ${inputs.length} 個滑桿（建議最多 2 個）`);

      // viewBox 版面（同一頁重複繪製多次，只檢查不重複的尺寸）
      const all = h._all.join('');
      const vbSet = new Set([...all.matchAll(/viewBox="0 0 ([\d.]+) ([\d.]+)"/g)].map((m) => m[1] + 'x' + m[2]));
      vbSet.forEach((vb) => {
        const [W, H] = vb.split('x').map(parseFloat);
        const ratio = W / H;
        if (ratio < 1.35) warn(`${tag}：viewBox ${W}x${H} 寬高比 ${ratio.toFixed(2)}（建議 ≥1.35，太高會被縮小）`);
        const cap = hasCtrl ? 300 : 320;
        if (H > cap) warn(`${tag}：viewBox 高度 ${H}（${hasCtrl ? '含滑桿' : '一般'}建議 ≤${cap}）`);
      });
    }
  });

  // sections 與實際使用的 sec 是否對得起來
  const declared = new Set((chap.sections || []).map((x) => String(x).split(/\s+/)[0]));
  [...secsInChapter].forEach((sec) => {
    if (!declared.has(sec)) err(`${where}：有投影片使用 sec='${sec}'，但 sections 沒有宣告這一節`);
  });
  [...declared].forEach((sec) => {
    if (!secsInChapter.has(sec)) warn(`${where}：sections 宣告了 '${sec}' 但沒有任何投影片使用`);
  });
});

/* ---------- index.html 一致性 ---------- */
const idxPath = path.join(dir, 'index.html');
if (fs.existsSync(idxPath)) {
  const idx = fs.readFileSync(idxPath, 'utf8');
  const declaredCh = [...idx.matchAll(/<script src="(ch\d+\.js)/g)].map((m) => m[1]);
  chFiles.forEach((f) => { if (!declaredCh.includes(f)) err(`index.html 沒有載入 ${f}`); });
  declaredCh.forEach((f) => { if (!chFiles.includes(f)) err(`index.html 載入了不存在的 ${f}`); });

  const vers = [...new Set([...idx.matchAll(/\?v=([0-9a-zA-Z]+)/g)].map((m) => m[1]))];
  if (vers.length > 1) err(`index.html 的 ?v= 版本號不一致：${vers.join(', ')}（改內容後要一起更新，否則瀏覽器拿到舊快取）`);
  else if (vers.length === 1) info.push(`資源版本號 ?v=${vers[0]}`);
  else warn('index.html 沒有 ?v= 版本號，改版後瀏覽器可能拿到快取的舊檔');

  ['engine.js', 'style.css', 'svg.js'].forEach((f) => {
    if (!idx.includes(f)) err(`index.html 沒有載入 ${f}`);
  });
}

/* ---------- 報告 ---------- */
const pages = slideCount + DECK.length;
if (!quiet) {
  console.log('');
  console.log('📊 ' + path.resolve(dir));
  console.log(`   ${DECK.length} 章、${slideCount} 張重點頁（含章名頁共 ${pages} 頁）`);
  console.log(`   互動頁 ${interactive} 張（${slideCount ? Math.round(interactive / slideCount * 100) : 0}%）、含範例 ${withExample} 張`);
  info.forEach((m) => console.log('   ' + m));
  console.log('');
}
if (warns.length) {
  console.log(`⚠️  提醒 ${warns.length} 則`);
  warns.forEach((m) => console.log('   · ' + m));
  console.log('');
}
if (errors.length) {
  console.log(`❌ 錯誤 ${errors.length} 則`);
  errors.forEach((m) => console.log('   · ' + m));
  console.log('');
  process.exit(1);
}
console.log('✅ 檢查通過，沒有錯誤。');
