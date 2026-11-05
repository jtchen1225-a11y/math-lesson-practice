/* validate_states.js — 全狀態版面檢查（由 validate_deck.py 注入暫存複本，不修改成品）。
   逐頁實際操作每一種會改變內容高度的互動，每個狀態都量：
   - 概念欄／視覺欄的高度與寬度是否超出
   - 圖中文字是否低於 28pt（引擎縮繪圖時會發生）
   - 公式是否超出欄位右緣
   - 封面「開始上課」按鈕是否在畫面內
   結果寫入 <pre id="mrd-states-result">。 */
window.addEventListener('load', async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);
  const out = [];
  const start = document.getElementById('startBtn');
  if (start) {
    const r = start.getBoundingClientRect();
    if (r.bottom > innerHeight || r.top < 0 || r.right > innerWidth) out.push({ page: 0, title: '封面', state: '開始按鈕在畫面外', vH: Math.max(0, Math.round(r.bottom - innerHeight)), vW: 0, iH: 0, iW: 0, clip: 0, minSvg: 0 });
    start.click();
  }
  await sleep(400);
  const T = +document.getElementById('progressText').textContent.split('/')[1];
  const MIN = 37.3;
  const slideEl = document.getElementById('slide');
  let pages = 0, states = 0;
  const measure = async (page, title, state) => {
    states++;
    if (window.MathJax && MathJax.typesetPromise) await MathJax.typesetPromise([slideEl]).catch(() => {});
    await sleep(40);
    window.dispatchEvent(new Event('resize'));
    await sleep(40);
    const vis = slideEl.querySelector('.slide-visual'), info = slideEl.querySelector('.slide-info');
    if (!vis) return;
    const o = v => Math.max(0, v);
    const vH = o(vis.scrollHeight - vis.clientHeight), vW = o(vis.scrollWidth - vis.clientWidth);
    const iH = info ? o(info.scrollHeight - info.clientHeight) : 0, iW = info ? o(info.scrollWidth - info.clientWidth) : 0;
    let minSvg = 1e9;
    vis.querySelectorAll('.visual-host svg text').forEach(t => {
      if (t.closest('mjx-container') || !t.getClientRects().length) return;
      const c = t.ownerSVGElement && t.ownerSVGElement.getScreenCTM();
      if (c) minSvg = Math.min(minSvg, parseFloat(getComputedStyle(t).fontSize) * Math.hypot(c.a, c.b));
    });
    let clip = 0;
    const vr = vis.getBoundingClientRect();
    vis.querySelectorAll('mjx-container').forEach(c => { const r = c.getBoundingClientRect(); if (r.width && r.right > vr.right + 2) clip = Math.max(clip, Math.round(r.right - vr.right)); });
    if (vH > 2 || vW > 2 || iH > 2 || iW > 2 || clip > 0 || minSvg < MIN) out.push({ page, title, state, vH, vW, iH, iW, clip, minSvg: minSvg < 1e9 ? +minSvg.toFixed(1) : 0 });
  };
  for (let i = 0; i < T; i++) {
    await sleep(100);
    const host = document.querySelector('.slide-visual .visual-host');
    if (host) {
      pages++;
      const title = (slideEl.querySelector('.slide-title') || {}).textContent || '';
      const M = s => measure(i + 1, title.slice(0, 30), s);
      await M('初始');
      const et = [...slideEl.querySelectorAll('.ex-toggle')].filter(b => !/放大/.test(b.textContent));
      if (et.length) { et.forEach(b => b.click()); await M('例題解答'); }
      const steps = [...host.querySelectorAll('[data-step]')];
      for (let k = 0; k < steps.length; k++) { steps[k].click(); await M('懸念第 ' + (k + 1) + ' 步'); }
      const cards = [...host.querySelectorAll('.ls-card')];
      const openCard = c => { const h = c.querySelector('[data-act="hint"]'), n = c.querySelectorAll('.ls-hints li').length; for (let k = 0; k < n; k++) h.click(); const a = c.querySelector('[data-act="ans"]'); if (a) a.click(); };
      const closeCard = c => { const h = c.querySelector('[data-act="hint"]'); if (h) h.click(); const a = c.querySelector('[data-act="ans"]'); if (a) a.click(); };
      const open = cards.filter(c => c.querySelector('[data-act]'));
      for (let k = 0; k < open.length; k++) { openCard(open[k]); await M(open[k].querySelector('.ls-tier-key').textContent + ' 層提示與答案全開'); closeCard(open[k]); }
      if (open.length > 1) { open.forEach(openCard); await M('所有層全開'); open.forEach(closeCard); }
      const r = host.querySelector('[data-act="reveal"]'); if (r) { r.click(); await M('揭曉'); r.click(); }
      const f = host.querySelector('[data-act="find"]'), x = host.querySelector('[data-act="fix"]');
      if (f) { f.click(); await M('標出錯誤'); if (x) { x.click(); await M('看修正'); x.click(); } f.click(); }
      const a = !cards.length && host.querySelector('[data-act="ans"]'); if (a) { a.click(); await M('參考答案'); a.click(); }
      for (const sl of host.querySelectorAll('input[type=range]')) {
        const lo = +sl.min, hi = +sl.max, keep = sl.value, anim = sl.classList.contains('ls-anim-r'), st = sl.classList.contains('steps-r');
        const vals = anim ? Array.from({ length: hi - lo }, (_, k) => k + 0.99) : st ? Array.from({ length: hi - lo + 1 }, (_, k) => lo + k) : Array.from({ length: 7 }, (_, k) => lo + (hi - lo) * k / 6);
        for (const v of vals) { sl.value = v; sl.dispatchEvent(new Event('input', { bubbles: true })); if (sl.oninput) sl.oninput(); await M((anim ? '動畫 ' : st ? '步驟 ' : '滑桿 ') + (+v).toFixed(2)); }
        sl.value = keep; sl.dispatchEvent(new Event('input', { bubbles: true })); if (sl.oninput) sl.oninput();
      }
    }
    document.getElementById('nextBtn').click();
  }
  const pre = document.createElement('pre'); pre.id = 'mrd-states-result';
  pre.textContent = JSON.stringify({ viewport: [innerWidth, innerHeight], pages, states, issues: out });
  document.body.appendChild(pre);
});
