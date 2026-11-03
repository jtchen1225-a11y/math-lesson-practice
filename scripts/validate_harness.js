/* ============================================================
   validate_harness.js — 瀏覽器互動驗證（由 validate_deck.py 注入「暫存副本」的 index.html，
   不會寫進成品資料夾）。

   使用實際的 engine.js、svg.js（SV）、MathJax 與章節檔，在真實 DOM 中：
   - 逐頁點「下一頁」渲染，記錄初次繪製的錯誤
   - 對每個 <input type="range">：設定值後觸發真正的 input 與 change 事件
     （oninput 屬性與 addEventListener 綁定都會收到），等繪圖與 MathJax 完成後檢查
   - 在 SV 共用繪圖入口檢查數值參數是否為有限數字、必要資料是否存在
   - 掃描繪圖 SVG 屬性中的 NaN／Infinity／undefined、圖形元素是否消失
   - 檢查 MathJax 錯誤節點與殘留原始 TeX；頁面若定義 selfCheck(h) 就一併執行
   結果寫入 <pre id="mrd-validate-result">（JSON），標題改為 VALIDATE-DONE。
   這些檢查抓不到所有除以 0 或數學錯誤；數學內容仍須人工核對。
   ============================================================ */
(function () {
  'use strict';
  const CAP = +(new URLSearchParams(location.search).get('cap') || 2001);   // 每個滑桿最多實測值數
  const R = { tool: 'validate_harness.js', started: new Date().toISOString(), cap: CAP, loadProblems: [], pages: [] };
  let ctx = '初始載入';
  const pending = [];
  const push = (kind, msg) => pending.push({ kind, msg: String(msg).slice(0, 300), where: ctx });
  const take = () => pending.splice(0);
  const fmt = v => {
    if (v === undefined) return 'undefined';
    if (typeof v === 'number') return String(v);
    try { const s = JSON.stringify(v); return s === undefined ? String(v) : s.slice(0, 80); } catch (e) { return String(v); }
  };
  const fin = v => typeof v === 'number' && isFinite(v);

  // ---- 錯誤收集（必須最早安裝） ----
  window.addEventListener('error', e => {
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) { push('資源載入失敗', t.src || t.href); return; }
    // file:// 下瀏覽器會把錯誤內容遮成「Script error.」；若事件處理入口已記下實際原因就不重複
    if (/^Script error\.?$/.test(e.message) && pending.some(p => p.kind === 'JavaScript 錯誤' && p.where === ctx)) return;
    push('JavaScript 錯誤', (e.message || e.error) + (e.lineno ? `（${String(e.filename || '').split('/').pop()}:${e.lineno}）` : ''));
  }, true);
  // 事件處理入口：包住 input／change／click 監聽器（addEventListener 與 oninput 等屬性），記下實際錯誤訊息後照常拋出
  const wrapFn = (fn, where) => function (...a) {
    try { return fn.apply(this, a); } catch (e) { push('JavaScript 錯誤', `${e && e.message || e}（${where}）`); throw e; }
  };
  const TYPES = new Set(['input', 'change', 'click']);
  const wrapped = new WeakMap();
  const addEL = EventTarget.prototype.addEventListener, rmEL = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    if (typeof fn === 'function' && TYPES.has(type)) {
      if (!wrapped.has(fn)) wrapped.set(fn, wrapFn(fn, `${type} 事件`));
      return addEL.call(this, type, wrapped.get(fn), opt);
    }
    return addEL.call(this, type, fn, opt);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opt) {
    return rmEL.call(this, type, (fn && wrapped.get(fn)) || fn, opt);
  };
  ['oninput', 'onchange', 'onclick'].forEach(prop => {
    const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    if (!d || !d.set) return;
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true, enumerable: d.enumerable,
      get() { return d.get.call(this); },
      set(fn) { d.set.call(this, typeof fn === 'function' ? wrapFn(fn, prop) : fn); }
    });
  });
  window.addEventListener('unhandledrejection', e => push('Promise 錯誤', e.reason && (e.reason.message || e.reason)));
  const origErr = console.error.bind(console);
  console.error = (...a) => { push('console.error', a.map(x => (x && x.message) ? x.message : String(x)).join(' ')); origErr(...a); };

  // ---- 在 SV 共用繪圖入口檢查參數（呼叫的仍是真正的 SV 函式） ----
  const NUM = { seg: [0, 1, 2, 3], dot: [0, 1], vlabel: [0, 1], angle: [0, 1, 2, 3, 4], rightAngle: [0, 1, 2, 3],
                ticks: [0, 1, 2, 3], pt: [0, 1, 2, 3], angleOf: [0, 1, 2, 3], arcPoints: [0, 1, 2, 3, 4] };
  const OPT_NUM = { dot: [3], vlabel: [4], rightAngle: [4], ticks: [4, 6], seg: [5] };
  function wrapSV() {
    if (typeof SV === 'undefined') { push('繪圖工具', '找不到 SV（svg.js 未載入）'); return; }
    for (const [fn, idx] of Object.entries(NUM)) {
      const orig = SV[fn];
      if (typeof orig !== 'function') continue;
      SV[fn] = function (...a) {
        idx.forEach(i => { if (!fin(a[i])) push(a[i] === undefined ? '繪圖資料缺少' : '繪圖參數無效', `SV.${fn} 第 ${i + 1} 個參數 = ${fmt(a[i])}`); });
        (OPT_NUM[fn] || []).forEach(i => { if (a[i] !== undefined && a[i] !== '' && !fin(a[i])) push('繪圖參數無效', `SV.${fn} 第 ${i + 1} 個參數 = ${fmt(a[i])}`); });
        return orig.apply(this, a);
      };
    }
    const poly = SV.poly;
    SV.poly = function (pts, ...rest) {
      if (!Array.isArray(pts) || pts.length < 2) push('繪圖資料缺少', `SV.poly 頂點資料 = ${fmt(pts)}（需要至少 2 個點的陣列）`);
      else pts.forEach((p, i) => {
        if (!Array.isArray(p) || p.length < 2 || !fin(p[0]) || !fin(p[1])) push('繪圖參數無效', `SV.poly 第 ${i + 1} 點 = ${fmt(p)}`);
      });
      return poly.call(this, pts, ...rest);
    };
    const plane = SV.plane;
    SV.plane = function (o) {
      const q = o || {};
      ['x0', 'y0', 'w', 'h', 'xmin', 'xmax', 'ymin', 'ymax', 'step'].forEach(k => {
        if (k in q && !fin(q[k])) push('繪圖參數無效', `SV.plane ${k} = ${fmt(q[k])}`);
      });
      const xmin = 'xmin' in q ? q.xmin : -6, xmax = 'xmax' in q ? q.xmax : 6, ymin = 'ymin' in q ? q.ymin : -6, ymax = 'ymax' in q ? q.ymax : 6;
      if (!(xmax > xmin)) push('繪圖參數無效', `SV.plane xmax(${xmax}) 必須大於 xmin(${xmin})`);
      if (!(ymax > ymin)) push('繪圖參數無效', `SV.plane ymax(${ymax}) 必須大於 ymin(${ymin})`);
      if ('step' in q && !(q.step > 0)) push('繪圖參數無效', `SV.plane step = ${fmt(q.step)}（必須大於 0）`);
      return plane.call(this, o);
    };
    const stepper = SV.stepper;
    SV.stepper = function (h, vb, steps, opt) {
      if (!Array.isArray(steps) || !steps.length) push('繪圖資料缺少', 'SV.stepper 步驟資料為空');
      return stepper.call(this, h, vb, steps, opt);
    };
    const fbox = SV.fbox;
    SV.fbox = function (rows, opt) {
      if (!Array.isArray(rows) || !rows.length) push('繪圖資料缺少', `SV.fbox 資料列 = ${fmt(rows)}`);
      return fbox.call(this, rows, opt);
    };
  }

  // ---- 等待繪圖與 MathJax 完成 ----
  const tick = () => new Promise(r => setTimeout(r, 0));
  async function mjIdle() {
    if (!(window.MathJax && MathJax.startup && MathJax.startup.promise)) return;
    for (let i = 0; i < 30; i++) {
      const p = MathJax.startup.promise;
      try { await p; } catch (e) { push('公式排版錯誤', e && e.message || e); }
      await tick();
      if (p === MathJax.startup.promise) return;
    }
  }
  async function settle() { await tick(); await mjIdle(); await tick(); await mjIdle(); }

  // ---- 檢查目前頁面 ----
  const slideEl = () => document.getElementById('slide');
  const graphicCount = host => host ? [...host.querySelectorAll('svg line, svg polyline, svg polygon, svg path, svg circle, svg rect, svg ellipse, svg text')]
    .filter(n => !n.closest('mjx-container')).length : 0;
  function inspect(slide, base) {
    const out = [];
    const el = slideEl();
    const host = el.querySelector('.visual-host');
    if (/視覺載入失敗/.test(el.textContent)) out.push({ kind: '繪圖失敗', msg: 'visual() 拋出錯誤，畫面顯示「視覺載入失敗」' });
    if (host) host.querySelectorAll('svg').forEach(s => {
      if (s.closest('mjx-container')) return;
      [s, ...s.querySelectorAll('*')].forEach(n => {
        for (const a of n.attributes) if (/NaN|Infinity|undefined/.test(a.value)) {
          out.push({ kind: 'SVG 無效數值', msg: `<${n.tagName} ${a.name}="${a.value.slice(0, 80)}">` });
        }
      });
    });
    const g = graphicCount(host);
    if (base && base.graphics > 0 && g === 0) out.push({ kind: '圖形缺失', msg: `初次繪製有 ${base.graphics} 個圖形元素，此時為 0` });
    el.querySelectorAll('mjx-merror, [data-mjx-error]').forEach(m =>
      out.push({ kind: '公式排版錯誤', msg: m.getAttribute('data-mjx-error') || m.textContent.slice(0, 80) }));
    const clone = el.cloneNode(true);
    clone.querySelectorAll('mjx-container, script, style').forEach(x => x.remove());
    const raw = clone.textContent.match(/\\\(|\\\)|\$\$|\\frac|\\sqrt|\\dfrac/g);
    if (raw) out.push({ kind: '公式未排版', msg: `殘留原始 TeX：${[...new Set(raw)].join(' ')}` });
    if (typeof slide.selfCheck === 'function') {
      try {
        const r = slide.selfCheck(host);
        (Array.isArray(r) ? r : (r ? [r] : [])).forEach(m => out.push({ kind: '頁面自訂檢查', msg: String(m) }));
      } catch (e) { out.push({ kind: '頁面自訂檢查', msg: 'selfCheck 拋出錯誤：' + e.message }); }
    }
    return out;
  }
  const dedupe = list => { const seen = new Set(); return list.filter(p => { const k = p.kind + '|' + p.msg; if (seen.has(k)) return false; seen.add(k); return true; }); };

  // ---- 滑桿值規劃：最小值、最大值與全部合法步進值（超過上限才抽樣並標示） ----
  function decimals(x) {
    const s = String(x);
    if (/e-/i.test(s)) return +s.split(/e-/i)[1];
    const i = s.indexOf('.');
    return i < 0 ? 0 : s.length - i - 1;
  }
  function plan(inp) {
    const min = inp.min === '' ? 0 : +inp.min, max = inp.max === '' ? 100 : +inp.max;
    const any = inp.step === 'any', step = any ? NaN : (inp.step === '' ? 1 : +inp.step);
    const info = { min, max, step: any ? 'any' : step, legalCount: null, sampled: false, note: '' };
    const vals = [];
    if (!(max >= min)) { info.note = `max(${max}) 小於 min(${min})`; return { info, vals: [min] }; }
    if (any || !(step > 0)) {
      info.sampled = true; info.note = 'step 非固定值，取 101 個等距抽樣值';
      for (let i = 0; i <= 100; i++) vals.push(min + (max - min) * i / 100);
      return { info, vals };
    }
    const dec = Math.min(12, Math.max(decimals(min), decimals(step)));
    const n = Math.floor((max - min) / step + 1e-9);
    const last = +(min + n * step).toFixed(dec);
    info.legalCount = n + 1;
    info.reachableMax = last;
    if (Math.abs(last - max) > 1e-9) info.note = `max=${max} 不在步進格上，瀏覽器實際可達最大值 ${last}`;
    if (n + 1 <= CAP) for (let i = 0; i <= n; i++) vals.push(+(min + i * step).toFixed(dec));
    else {
      info.sampled = true;
      info.note = (info.note ? info.note + '；' : '') + `合法值共 ${n + 1} 個，超過上限 ${CAP}，只抽樣 ${CAP} 個（含兩端）`;
      for (let j = 0; j < CAP; j++) vals.push(+(min + Math.round(j * n / (CAP - 1)) * step).toFixed(dec));
    }
    return { info, vals: [...new Set(vals)] };
  }
  const fire = inp => {
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const labelOf = (inp, k) => inp.id ? '#' + inp.id : (inp.className ? '.' + String(inp.className).trim().split(/\s+/).join('.') : `range[${k}]`);
  const strip = s => String(s || '').replace(/<[^>]*>/g, '');

  async function run() {
    for (let i = 0; i < 300 && !(window.MathJax && MathJax.startup && MathJax.startup.promise); i++) await new Promise(r => setTimeout(r, 50));
    if (!(window.MathJax && MathJax.startup)) push('公式排版錯誤', 'MathJax 未載入');
    await mjIdle();
    wrapSV();
    R.loadProblems = take();
    const flat = [];
    (window.DECK || []).forEach(c => { flat.push(null); (c.slides || []).forEach(s => flat.push(s)); });
    R.totalItems = flat.length;
    document.getElementById('startBtn').click();
    for (let i = 0; i < flat.length; i++) {
      ctx = `第 ${i + 1} 頁 初次繪製`;
      if (i > 0) document.getElementById('nextBtn').click();
      await settle();
      const s = flat[i];
      if (!s) { const p = take(); if (p.length) R.pages.push({ page: i + 1, divider: true, initial: p, sliders: [] }); continue; }
      const host = slideEl().querySelector('.visual-host');
      const base = { graphics: graphicCount(host) };
      const page = { page: i + 1, sec: s.sec, title: strip(s.title), selfCheck: typeof s.selfCheck === 'function',
                     graphicsInitial: base.graphics, initial: dedupe(take().concat(inspect(s, null))), sliders: [], combos: null };
      const inputs = [...slideEl().querySelectorAll('input[type="range"]')];
      const init = inputs.map(x => x.value);
      for (let k = 0; k < inputs.length; k++) {
        const inp = inputs[k], label = labelOf(inp, k);
        const { info, vals } = plan(inp);
        const rec = Object.assign({ slider: label, initial: init[k],
          others: inputs.length > 1 ? '其他滑桿固定在初始值：' + inputs.map((o, j) => j === k ? null : `${labelOf(o, j)}=${init[j]}`).filter(Boolean).join('、') : '',
          tested: [], failureCount: 0, failures: [] }, info);
        for (const v of vals) {
          inputs.forEach((o, j) => { if (j !== k) o.value = init[j]; });
          inp.value = String(v);
          const actual = inp.value;
          ctx = `第 ${i + 1} 頁 ${label}=${actual}`;
          fire(inp);
          await settle();
          const probs = dedupe(take().concat(inspect(s, base)));
          rec.tested.push(actual);
          if (probs.length) { rec.failureCount++; if (rec.failures.length < 15) rec.failures.push({ value: actual, problems: probs.slice(0, 6) }); }
        }
        const nums = rec.tested.map(Number);
        rec.testedCount = new Set(rec.tested).size;
        rec.includesMin = nums.some(x => Math.abs(x - info.min) < 1e-9);
        const top = info.reachableMax !== undefined ? info.reachableMax : info.max;
        rec.includesMax = nums.some(x => Math.abs(x - top) < 1e-9);
        inp.value = init[k]; fire(inp); await settle(); take();
        page.sliders.push(rec);
      }
      if (inputs.length >= 2) {
        if (2 ** inputs.length <= 16) {
          page.combos = { note: '端點組合（每個滑桿取最小或最大值）；不是全部組合的窮舉', tested: [], failures: [] };
          for (let m = 0; m < 2 ** inputs.length; m++) {
            const set = inputs.map((o, j) => { o.value = String((m >> j) & 1 ? o.max : o.min); return `${labelOf(o, j)}=${o.value}`; });
            ctx = `第 ${i + 1} 頁 端點組合 ${set.join('、')}`;
            inputs.forEach(fire);
            await settle();
            const probs = dedupe(take().concat(inspect(s, base)));
            page.combos.tested.push(set.join('、'));
            if (probs.length) page.combos.failures.push({ value: set.join('、'), problems: probs.slice(0, 6) });
          }
          inputs.forEach((o, j) => { o.value = init[j]; fire(o); });
          await settle(); take();
        } else page.combos = { note: `滑桿 ${inputs.length} 個，端點組合超過 16 種，未測組合` };
      }
      R.pages.push(page);
    }
  }
  function finish() {
    R.finished = new Date().toISOString();
    const pre = document.createElement('pre');
    pre.id = 'mrd-validate-result';
    pre.textContent = JSON.stringify(R);
    document.body.appendChild(pre);
    document.title = 'VALIDATE-DONE';
  }
  window.addEventListener('load', () => {
    run().catch(e => { R.fatal = String(e && e.stack || e); }).then(finish);
  });
})();
