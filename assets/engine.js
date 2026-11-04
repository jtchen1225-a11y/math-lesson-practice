/* ============================================================
   engine.js — 簡報導覽與渲染引擎
   讀取 window.DECK（各章 push 進來），攤平成投影片序列。
   ============================================================ */
(function () {
  const DECK = window.DECK || [];
  // [課堂版] 單位改為「階段」（index.html 設定 window.MRD_UNIT）；章物件可帶 time（例：'0–5 分鐘'）
  const UNIT = window.MRD_UNIT || '章';
  const unitOf = n => `第 ${n} ${UNIT}`;
  const unitTime = c => unitOf(c.ch) + (c.time ? ` · ${c.time}` : '');

  // 攤平：每章先放一張章名分隔頁，再放內容頁
  const flat = [];
  DECK.forEach((chap, ci) => {
    flat.push({ type: 'divider', ch: chap.ch, color: chap.color, title: chap.title, time: chap.time, sections: chap.sections });
    chap.slides.forEach(s => flat.push(Object.assign({ type: 'slide', ch: chap.ch, color: chap.color }, s)));
  });

  let idx = 0;

  // ---- MathJax 排版（載入前先重試，載入後自動補排版）----
  function typeset(el, tries = 0) {
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([el]).catch(() => {});
    } else if (tries < 60) {
      setTimeout(() => typeset(el, tries + 1), 200);
    }
  }

  // ---- [本機修改] 不自動縮小：偵測內容是否超出欄位，超出就顯示「請分頁」提示 ----
  // 原版會把超出的內容等比縮小（下限 0.5），投影時字會變得太小；改為不縮放、欄位可捲動、明確提示。
  // 窄視窗（≤1080px）為單欄整頁捲動，不提示。
  window.MRD_OVERFLOW = {};          // { 頁序: ['概念欄', '視覺欄'] }
  function overflowOf(box) {
    return !!box && box.clientHeight > 0 && box.scrollHeight > box.clientHeight + 2;
  }
  // [課堂版] 視覺欄放不下時，只縮繪圖（SVG）讓出空間；公式、字幕、滑桿維持原大小。
  // 高度記在 host 的 CSS 變數：自寫滑桿每次重畫都換新的 <svg>，變數才留得住；同一頁只縮不放，拖滑桿時版面不跳動。
  const MIN_DRAWING_PX = 160;
  function fitDrawing() {
    const vis = slideEl.querySelector('.slide-visual'), host = vis && vis.querySelector('.visual-host');
    if (!host) return;
    const over = vis.scrollHeight - vis.clientHeight;
    if (over <= 2) return;
    let big = null, bigH = 0;
    host.querySelectorAll('svg').forEach(s => {
      if (s.closest('mjx-container')) return;
      const r = s.getBoundingClientRect().height;
      if (r > bigH) { big = s; bigH = r; }
    });
    if (!big || bigH <= MIN_DRAWING_PX) return;
    host.style.setProperty('--mrd-drawing-max', Math.max(MIN_DRAWING_PX, Math.floor(bigH - over - 4)) + 'px');
  }
  function resetDrawing() {
    const host = slideEl && slideEl.querySelector('.slide-visual .visual-host');
    if (host) host.style.removeProperty('--mrd-drawing-max');
  }
  function fitSlide() {
    if (!slideEl) return;
    const old = document.querySelector('.mrd-overflow-banner');
    if (old) old.remove();
    if (slideEl.classList.contains('divider') || window.innerWidth <= 1080) { delete window.MRD_OVERFLOW[idx]; return; }
    fitDrawing();
    const where = [];
    if (overflowOf(slideEl.querySelector('.slide-info'))) where.push('概念欄');
    if (overflowOf(slideEl.querySelector('.slide-visual'))) where.push('視覺欄');
    if (where.length) {
      window.MRD_OVERFLOW[idx] = where;
      const b = document.createElement('div');
      b.className = 'mrd-overflow-banner';
      b.textContent = `⚠ 第 ${idx + 1} 頁${where.join('、')}內容超出畫面，請拆成兩頁（不會自動縮字）`;
      // 放在頂部列（不蓋住投影片內容）
      const bar = document.querySelector('.topbar');
      bar.insertBefore(b, bar.querySelector('.top-actions'));
      console.warn(b.textContent);
    } else {
      delete window.MRD_OVERFLOW[idx];
    }
  }
  // MathJax 排版完成後才量高縮放（公式高度需排版後才確定）
  function typesetAndFit(el, tries = 0) {
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([el]).then(fitSlide).catch(fitSlide);
    } else if (tries < 60) {
      setTimeout(() => typesetAndFit(el, tries + 1), 200);
    } else { fitSlide(); }
  }

  /* ========== 範例／圖解「放大成整頁」（方便用畫筆講解）========== */
  let zoomHost = null, zoomHostParent = null;   // 圖解模式被移入放大層的 host 及其原父節點
  function ensureZoom() {
    if (document.getElementById('zoomModal')) return;
    const m = document.createElement('div');
    m.id = 'zoomModal'; m.className = 'zoom-modal hidden';
    m.innerHTML = `<div class="zoom-body" id="zoomBody"></div>`;
    document.body.appendChild(m);
    const bar = document.createElement('div');
    bar.id = 'zoomBar'; bar.className = 'zoom-bar hidden';
    bar.innerHTML = `<div class="zoom-badge" id="zoomBadge"></div>
      <button class="zoom-btn" id="zoomSol">顯示解答</button>
      <button class="zoom-btn zoom-x" id="zoomClose">✕ 關閉</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#zoomClose').onclick = closeZoom;
    bar.querySelector('#zoomSol').onclick = () => {
      const box = document.getElementById('zoomSolBox'); if (!box) return;
      box.classList.toggle('show');
      bar.querySelector('#zoomSol').textContent = box.classList.contains('show') ? '收起解答' : '顯示解答';
      typeset(box);
    };
  }
  function showZoom(s, badgeTail) {
    ensureZoom();
    document.getElementById('zoomBadge').innerHTML = `${unitOf(s.ch)} · ${s.sec} ${s.secName || ''}　${badgeTail}`;
    document.getElementById('zoomModal').style.setProperty('--ct', s.color);
    document.getElementById('zoomBar').style.setProperty('--ct', s.color);
    document.getElementById('zoomModal').classList.remove('hidden');
    document.getElementById('zoomBar').classList.remove('hidden');
  }
  function openExampleModal(s) {
    ensureZoom();
    document.getElementById('zoomSol').style.display = '';
    document.getElementById('zoomSol').textContent = '顯示解答';
    document.getElementById('zoomBody').innerHTML =
      `<div class="zoom-q">${s.example.q}</div>
       <div class="zoom-sol" id="zoomSolBox">
         ${s.example.steps ? `<ol>${s.example.steps.map(t => `<li>${t}</li>`).join('')}</ol>` : ''}
         ${s.example.ans ? `<div class="zoom-ans">答：${s.example.ans}</div>` : ''}
       </div>`;
    showZoom(s, '範例');
    typeset(document.getElementById('zoomBody'));
  }
  // 放大層：把 host 內容等比放大到填滿整頁
  // 繪圖 SVG 有 viewBox，寬度撐滿就會連同裡面的字一起放大，不必特別處理；
  // 但「重點整理／易錯對照」這類 HTML 內容（fbox 公式卡、表格）字級是固定 px，
  // 框會被撐大、字卻還是原來大小 → 必須用 transform 等比放大整塊。
  function fitZoomHost() {
    const host = zoomHost;
    if (!host) return;
    const body = document.getElementById('zoomBody');
    if (!body) return;
    const isDrawing = !!host.querySelector('svg:not(mjx-container svg)');
    if (isDrawing) { host.style.width = ''; host.style.transform = 'none'; return; }
    // 以「原本在投影片視覺欄的寬度」當基準寬度，再整塊等比放大，維持原有版面比例
    const baseW = +host.dataset.zoomBase || 460;
    host.style.width = baseW + 'px';
    host.style.margin = '0 auto';
    host.style.transformOrigin = 'top center';
    host.style.transform = 'none';
    // .zoom-body > .visual-host 預設 flex:1 會撐滿整個放大層高度，
    // 那樣量到的是「容器高」而不是「內容自然高」，算出來的倍率永遠是 1；
    // 先解除彈性伸展改為 height:auto，才量得到真正需要的高度。
    host.style.flex = 'none';
    host.style.height = 'auto';
    const needH = host.scrollHeight;
    if (!needH) return;
    const k = Math.max(1, Math.min(body.clientWidth / baseW, body.clientHeight / needH, 3.4));
    host.style.transform = 'scale(' + k.toFixed(4) + ')';
  }
  function openVisualModal(s, host) {
    ensureZoom();
    document.getElementById('zoomSol').style.display = 'none';   // 圖解不需要「顯示解答」
    const body = document.getElementById('zoomBody');
    body.innerHTML = '';
    zoomHost = host; zoomHostParent = host.parentNode;
    host.dataset.zoomBase = Math.round(host.getBoundingClientRect().width) || 460;
    host.style.transform = 'none';   // 取消縮圖時的縮放，放大層用滿版
    body.appendChild(host);
    showZoom(s, '圖解');
    // MathJax 排版完才量得到真實高度，排版後再算放大倍率
    if (window.MathJax && MathJax.typesetPromise) {
      MathJax.typesetPromise([body]).then(fitZoomHost).catch(fitZoomHost);
    } else { typeset(body); setTimeout(fitZoomHost, 300); }
  }
  function closeZoom() {
    const m = document.getElementById('zoomModal');
    if (!m || m.classList.contains('hidden')) return;
    if (zoomHost && zoomHostParent) {
      // 還原放大層加上的行內樣式，否則回到投影片會殘留寬度與縮放
      zoomHost.style.width = ''; zoomHost.style.margin = '';
      zoomHost.style.flex = ''; zoomHost.style.height = '';
      zoomHost.style.transform = ''; zoomHost.style.transformOrigin = '';
      delete zoomHost.dataset.zoomBase;
      zoomHostParent.insertBefore(zoomHost, zoomHostParent.firstChild);   // 把圖放回原視覺欄
      zoomHost = null; zoomHostParent = null;
    }
    document.getElementById('zoomBody').innerHTML = '';
    m.classList.add('hidden');
    document.getElementById('zoomBar').classList.add('hidden');
    if (typeof clearPen === 'function') clearPen();   // 清掉講解時的筆跡
    fitSlide();
  }

  // [本機修改] 寬度 ≤1440px 時目錄改為浮動層（不占投影片寬度），與 projection.css 的斷點一致
  const tocIsOverlay = () => window.matchMedia('(max-width: 1440px)').matches;

  // ---- DOM ----
  const $ = id => document.getElementById(id);
  const slideEl = $('slide');
  const crumbEl = $('crumb');
  const tocEl = $('toc');
  const progFill = $('progressFill');
  const progText = $('progressText');
  const prevBtn = $('prevBtn');
  const nextBtn = $('nextBtn');

  // ---- 封面章節卡 ----
  (function buildCover() {
    const host = $('coverChapters');
    DECK.forEach(c => {
      const card = document.createElement('div');
      card.className = 'cover-card';
      card.style.setProperty('--ct', c.color);
      card.innerHTML = `<div class="cc-num">${unitTime(c)}</div>
        <div class="cc-title">${c.title}</div>
        <div class="cc-list">${c.sections.join('　')}</div>`;
      host.appendChild(card);
    });
  })();

  // ---- 目錄 ----
  function buildTOC() {
    tocEl.innerHTML = '';
    DECK.forEach(chap => {
      const wrap = document.createElement('div');
      wrap.className = 'toc-chapter open';
      wrap.style.setProperty('--ct', chap.color);
      const head = document.createElement('div');
      head.className = 'toc-chead';
      head.innerHTML = `<span class="toc-dot"></span>${unitOf(chap.ch)}　${chap.title}`;
      head.onclick = () => wrap.classList.toggle('open');
      wrap.appendChild(head);
      const items = document.createElement('div');
      items.className = 'toc-items';
      flat.forEach((s, i) => {
        if (s.type !== 'slide' || s.ch !== chap.ch) return;
        const b = document.createElement('button');
        b.className = 'toc-item';
        b.dataset.i = i;
        b.innerHTML = `<span class="ti-sec">${s.sec}</span>${s.title}`;
        b.onclick = () => { go(i); if (tocIsOverlay()) tocEl.classList.remove('open'); };
        items.appendChild(b);
      });
      wrap.appendChild(items);
      tocEl.appendChild(wrap);
    });
  }

  function markTOC() {
    tocEl.querySelectorAll('.toc-item').forEach(b => {
      b.classList.toggle('active', +b.dataset.i === idx);
    });
  }

  // ---- 渲染單頁 ----
  function render() {
    const s = flat[idx];
    slideEl.style.setProperty('--ct', s.color);

    if (s.type === 'divider') {
      slideEl.className = 'slide divider';
      slideEl.innerHTML = `
        <div>
          <div class="dv-num">${unitTime(s)}</div>
          <div class="dv-title">${s.title}</div>
          <div class="dv-list">${s.sections.map(x => `<span class="dv-chip">${x}</span>`).join('')}</div>
        </div>`;
      crumbEl.innerHTML = `${unitTime(s)}　<b>${s.title}</b>`;
    } else {
      slideEl.className = 'slide';
      // 左：概念欄
      const info = document.createElement('div');
      info.className = 'slide-info';
      let html = `<div class="badge">${unitOf(s.ch)} · ${s.sec} ${s.secName || ''}</div>
        <h2 class="slide-title">${s.title}</h2>`;
      if (s.formula) {
        html += `<div class="formula">${s.formula.label ? `<div class="formula-label">${s.formula.label}</div>` : ''}$$${s.formula.tex}$$</div>`;
      }
      if (s.points && s.points.length) {
        html += `<ul class="points">${s.points.map(p => `<li>${p}</li>`).join('')}</ul>`;
      }
      if (s.example) {
        html += `<div class="example">
          <div class="ex-head">範例<button class="ex-zoom" title="放大成整頁，方便用畫筆講解">🔍 放大</button></div>
          <div class="ex-q">${s.example.q}</div>
          <button class="ex-toggle">顯示解答</button>
          <div class="ex-sol">
            ${s.example.steps ? `<ol>${s.example.steps.map(t => `<li>${t}</li>`).join('')}</ol>` : ''}
            ${s.example.ans ? `<div class="ex-ans">答：${s.example.ans}</div>` : ''}
          </div>
        </div>`;
      }
      info.innerHTML = '<div class="col-fit">' + html + '</div>';

      // 右：視覺欄
      const vis = document.createElement('div');
      vis.className = 'slide-visual';
      const host = document.createElement('div');
      host.className = 'visual-host';
      vis.appendChild(host);
      if (s.caption) {
        const cap = document.createElement('div');
        cap.className = 'visual-caption';
        cap.innerHTML = s.caption;
        vis.appendChild(cap);
      }
      // 圖解「放大成整頁」按鈕（浮在視覺欄右上角）
      const visZoom = document.createElement('button');
      visZoom.className = 'vis-zoom';
      visZoom.title = '放大成整頁，方便用畫筆講解';
      visZoom.textContent = '🔍 放大';
      visZoom.onclick = () => openVisualModal(s, host);
      vis.appendChild(visZoom);

      slideEl.innerHTML = '';
      slideEl.appendChild(info);
      slideEl.appendChild(vis);

      // 視覺內容：字串 or 函式
      window.MRD_SLIDE_KEY = s.sec;   // [課堂版] 課堂元件依此保存本頁狀態
      if (typeof s.visual === 'function') {
        try { s.visual(host); } catch (e) { host.innerHTML = '<p style="color:#e11d48">視覺載入失敗</p>'; console.error(e); }
      } else {
        host.innerHTML = s.visual || '';
      }

      // 範例展開
      const tog = info.querySelector('.ex-toggle');
      if (tog) {
        const sol = info.querySelector('.ex-sol');
        tog.onclick = () => {
          sol.classList.toggle('show');
          tog.textContent = sol.classList.contains('show') ? '收起解答' : '顯示解答';
          // 展開/收起解答會改變概念欄高度 → 排版後重新縮放
          if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise([sol]).then(fitSlide).catch(fitSlide);
          else fitSlide();
        };
      }
      // 範例「放大成整頁」按鈕
      const exZoom = info.querySelector('.ex-zoom');
      if (exZoom) exZoom.onclick = () => openExampleModal(s);

      crumbEl.innerHTML = `${unitOf(s.ch)} · ${s.sec} <b>${s.title}</b>`;
    }

    // 進度
    progFill.style.width = ((idx + 1) / flat.length * 100) + '%';
    progText.textContent = `${idx + 1} / ${flat.length}`;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === flat.length - 1;
    markTOC();

    // MathJax（若尚未載入完成，typeset 會自動重試補上）；排版後自動縮放使整頁免捲動
    typesetAndFit(slideEl);
    slideEl.scrollTop = 0;
    if (typeof clearPen === 'function') clearPen(); // 換頁清除筆跡
  }

  function go(i) {
    closeZoom();
    idx = Math.max(0, Math.min(flat.length - 1, i));
    render();
  }
  function next() { if (idx < flat.length - 1) go(idx + 1); }
  function prev() { if (idx > 0) go(idx - 1); }

  // ---- 事件 ----
  const app = $('app');
  function toggleSidebar() {
    if (!tocIsOverlay()) app.classList.toggle('toc-collapsed');
    else tocEl.classList.toggle('open');
    // 版面寬度改變 → 重新縮放（延一格等 grid 重排完成）
    requestAnimationFrame(() => { resetDrawing(); fitSlide(); });
  }
  prevBtn.onclick = prev;
  nextBtn.onclick = next;
  $('tocToggle').onclick = toggleSidebar;
  $('homeBtn').onclick = () => { app.classList.add('hidden'); $('cover').classList.remove('hidden'); };
  $('startBtn').onclick = () => { $('cover').classList.add('hidden'); app.classList.remove('hidden'); fitPen(); render(); };

  /* ================= 授課教具 ================= */
  const canvas = $('penCanvas'), penCtx = canvas.getContext('2d');
  const laserDot = $('laserDot');
  let laserOn = false, penOn = false, drawing = false, erasing = false, penColor = '#e11d48', lastPt = null;

  // 雷射拖尾：獨立畫布，畫出會隨時間淡出的紅色軌跡（不影響畫筆畫布）
  const laserCanvas = document.createElement('canvas');
  laserCanvas.className = 'laser-canvas';
  document.body.appendChild(laserCanvas);
  const lctx = laserCanvas.getContext('2d');
  let laserPts = [];           // 近期軌跡點 {x, y, t}
  let laserRAF = null;
  const LASER_LIFE = 1600;     // 每段筆跡殘留時間（毫秒）→ 之後淡出消失
  function drawLaserTrail() {
    syncLaserCanvas();
    const now = performance.now();
    laserPts = laserPts.filter(p => now - p.t < LASER_LIFE);
    lctx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
    for (let i = 1; i < laserPts.length; i++) {
      const a = laserPts[i - 1], b = laserPts[i];
      const alpha = Math.max(0, 1 - (now - b.t) / LASER_LIFE);   // 越新越濃，隨時間淡出
      lctx.strokeStyle = 'rgba(255,42,42,' + (0.6 * alpha).toFixed(3) + ')';
      lctx.lineWidth = 3 + 5 * alpha;
      lctx.beginPath(); lctx.moveTo(a.x, a.y); lctx.lineTo(b.x, b.y); lctx.stroke();
    }
    if (laserOn || laserPts.length > 1) laserRAF = requestAnimationFrame(drawLaserTrail);
    else { lctx.clearRect(0, 0, laserCanvas.width, laserCanvas.height); laserRAF = null; }
  }

  function fitPen() {
    const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1;
    if (canvas._w === w && canvas._h === h) return; // 尺寸未變就不重設，避免清掉筆跡
    canvas._w = w; canvas._h = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    penCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    penCtx.lineCap = 'round'; penCtx.lineJoin = 'round';
  }
  // 雷射畫布尺寸自我校正（不受 fitPen 的 early-return 影響；尺寸相符時為 no-op）
  function syncLaserCanvas() {
    const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1;
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (laserCanvas.width === cw && laserCanvas.height === ch) return;
    laserCanvas.width = cw; laserCanvas.height = ch;
    laserCanvas.style.width = w + 'px'; laserCanvas.style.height = h + 'px';
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.lineCap = 'round'; lctx.lineJoin = 'round';
  }
  function clearPen() { if (penCtx) penCtx.clearRect(0, 0, canvas.width, canvas.height); }

  function setLaser(on) {
    laserOn = on;
    if (on) setPen(false);
    app.classList.toggle('laser-on', on);
    laserDot.classList.toggle('hidden', !on);
    $('dkLaser').classList.toggle('active', on);
    if (on) { syncLaserCanvas(); if (!laserRAF) laserRAF = requestAnimationFrame(drawLaserTrail); }
    // 關閉時不清點：讓已畫出的拖尾自然淡出後停止
  }
  function setPen(on) {
    penOn = on;
    if (on) setLaser(false);
    app.classList.toggle('pen-on', on);
    canvas.style.pointerEvents = on ? 'auto' : 'none';
    $('dkPen').classList.toggle('active', on);
    $('dkColors').classList.toggle('hidden', !on);
  }

  // 雷射點跟隨 + 記錄拖尾軌跡
  document.addEventListener('mousemove', e => {
    if (laserOn) {
      laserDot.style.left = e.clientX + 'px'; laserDot.style.top = e.clientY + 'px';
      laserPts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (laserPts.length > 600) laserPts.shift();
    }
  });

  // 畫筆繪製（滑鼠＋觸控）
  const ptOf = e => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
  function penStart(e) { if (!penOn) return; drawing = true; lastPt = ptOf(e); e.preventDefault(); }
  function penMove(e) {
    if (!penOn || !drawing) return;
    const p = ptOf(e);
    penCtx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    penCtx.strokeStyle = penColor;
    penCtx.lineWidth = erasing ? 26 : 3.6;
    penCtx.beginPath(); penCtx.moveTo(lastPt.x, lastPt.y); penCtx.lineTo(p.x, p.y); penCtx.stroke();
    lastPt = p; e.preventDefault();
  }
  function penEnd() { drawing = false; }
  canvas.addEventListener('mousedown', penStart);
  canvas.addEventListener('mousemove', penMove);
  window.addEventListener('mouseup', penEnd);
  canvas.addEventListener('touchstart', penStart, { passive: false });
  canvas.addEventListener('touchmove', penMove, { passive: false });
  window.addEventListener('touchend', penEnd);

  // 工具列按鈕
  $('dkSidebar').onclick = toggleSidebar;
  $('dkPrev').onclick = prev;
  $('dkNext').onclick = next;
  $('dkLaser').onclick = () => setLaser(!laserOn);
  $('dkPen').onclick = () => setPen(!penOn);
  $('dkClear').onclick = clearPen;
  $('dkErase').onclick = () => {
    erasing = !erasing;
    $('dkErase').classList.toggle('active', erasing);
    if (erasing && !penOn) setPen(true);
  };
  document.querySelectorAll('.dcolor').forEach(b => {
    b.onclick = () => {
      penColor = b.dataset.c; erasing = false;
      $('dkErase').classList.remove('active');
      document.querySelectorAll('.dcolor').forEach(x => x.classList.toggle('active', x === b));
      if (!penOn) setPen(true);
    };
  });
  // [本機新增] 教具列收合／展開（按鈕或鍵盤 T）；收合後只留這顆按鈕，其餘按鈕隱藏
  function setDock(open) {
    const dock = $('dock'), t = $('dkToggle');
    dock.classList.toggle('collapsed', !open);
    app.classList.toggle('dock-collapsed', !open);
    t.setAttribute('aria-expanded', String(open));
    t.setAttribute('aria-label', open ? '收合教具列' : '展開教具列');
    t.title = (open ? '收合教具列' : '展開教具列') + ' (T)';
    requestAnimationFrame(() => { resetDrawing(); fitSlide(); });
  }
  $('dkToggle').onclick = () => setDock($('dock').classList.contains('collapsed'));

  $('dkFull').onclick = () => {
    if (!document.fullscreenElement) (document.documentElement.requestFullscreen && document.documentElement.requestFullscreen());
    else document.exitFullscreen();
  };
  window.addEventListener('resize', () => { fitPen(); resetDrawing(); fitSlide(); fitZoomHost(); });
  // 拖動滑桿／步驟器時，說明文字行數可能改變（例如步驟說明從一行變兩行），
  // 導致視覺欄需要重新量高縮放；用 rAF 去抖，避免拖曳過程重複計算
  let _refitRAF = null, _refitLate = null;
  slideEl.addEventListener('input', () => {
    if (_refitRAF) return;
    _refitRAF = requestAnimationFrame(() => { _refitRAF = null; fitSlide(); });
    clearTimeout(_refitLate);
    _refitLate = setTimeout(fitSlide, 250);   // [課堂版] 滑桿更新公式時 MathJax 排版較慢，排完再量一次
  });
  fitPen();

  document.addEventListener('keydown', e => {
    if ($('app').classList.contains('hidden')) {
      if (e.key === 'Enter' || e.key === ' ') { $('startBtn').click(); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(flat.length - 1);
    else if (e.key === 'Escape') { closeZoom(); setLaser(false); setPen(false); }
    else if (e.key === 'l' || e.key === 'L') setLaser(!laserOn);
    else if (e.key === 'p' || e.key === 'P') setPen(!penOn);
    else if (e.key === 'c' || e.key === 'C') clearPen();
    else if (e.key === 't' || e.key === 'T') setDock($('dock').classList.contains('collapsed'));
  });

  buildTOC();
  window.MRD_RERENDER = render;   // [課堂版] 清除課堂紀錄後重畫目前頁面

  // 深連結：#present 直接進入簡報；#p=N 直接跳到第 N 頁
  (function bootFromHash() {
    const hash = location.hash || '';
    const m = hash.match(/#p=(\d+)/);
    if (hash === '#present' || m) {
      $('cover').classList.add('hidden');
      $('app').classList.remove('hidden');
      fitPen();
      go(m ? +m[1] : 0);
    }
  })();

  /* ========== [本機新增] ?check 檢查模式：逐頁實際渲染，量測超出與實際字級 ==========
     網址加 ?check（例：index.html?check）開啟。結果顯示在畫面上，並存於 window.MRD_REPORT。
     - 超出：概念欄／視覺欄內容高於欄位（窄視窗 ≤1080px 時不檢查）
     - 字級：教學文字（HTML）與 SVG 圖中文字的「實際螢幕像素」，SVG 會乘上目前的縮放比例
     - 公式：MathJax 錯誤節點、殘留原始 TeX
     只反映目前視窗大小下的結果；換投影解析度要重測。不檢查數學內容是否正確。 */
  const MIN_PX = 37.3;   // 28pt
  const UI_SKIP = '.badge, .ex-toggle, .ex-zoom, .vis-zoom, .step-hint, .mrd-overflow-banner, .ls-ui';   // [課堂版] .ls-ui＝課堂元件的操作按鈕
  function measureSlide() {
    const small = [];
    const add = (kind, text, px) => small.push(`${kind}「${String(text).trim().slice(0, 16)}」${px.toFixed(1)}px`);
    // HTML 教學文字：有直接文字內容的元素
    slideEl.querySelectorAll('.slide-info *, .slide-visual *').forEach(el => {
      if (el.closest('svg') || el.closest('mjx-container') || el.closest(UI_SKIP)) return;
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own || !el.getClientRects().length) return;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < MIN_PX) add('文字', el.textContent, px);
    });
    // SVG 圖中文字（不含 MathJax）：font-size（使用者單位）× 實際縮放
    slideEl.querySelectorAll('.visual-host svg text').forEach(t => {
      if (t.closest('mjx-container')) return;
      const svgEl = t.ownerSVGElement, ctm = svgEl && svgEl.getScreenCTM();
      if (!ctm || !t.getClientRects().length) return;
      const px = parseFloat(getComputedStyle(t).fontSize) * Math.hypot(ctm.a, ctm.b);
      if (px < MIN_PX) add('圖中文字', t.textContent, px);
    });
    // MathJax 公式字級
    slideEl.querySelectorAll('mjx-container').forEach(c => {
      if (c.closest(UI_SKIP) || !c.getClientRects().length) return;
      const px = parseFloat(getComputedStyle(c).fontSize);
      if (px < MIN_PX) add('公式', c.getAttribute('aria-label') || 'math', px);
    });
    const merr = slideEl.querySelectorAll('mjx-merror, [data-mjx-error]').length;
    const clone = slideEl.cloneNode(true);
    clone.querySelectorAll('mjx-container, script').forEach(x => x.remove());
    const raw = (clone.textContent.match(/\\\(|\\\)|\$\$|\\frac|\\sqrt/g) || []).length;
    const failed = /視覺載入失敗/.test(slideEl.textContent);
    return { small, merr, raw, failed, overflow: window.MRD_OVERFLOW[idx] || [] };
  }
  async function runCheck() {
    $('cover').classList.add('hidden'); $('app').classList.remove('hidden'); fitPen();
    const wait = () => new Promise(r => setTimeout(r, 120));
    for (let t = 0; t < 100 && !(window.MathJax && MathJax.typesetPromise); t++) await wait();
    const rows = [], report = [];
    for (let i = 0; i < flat.length; i++) {
      go(i);
      if (window.MathJax && MathJax.typesetPromise) { try { await MathJax.typesetPromise([slideEl]); } catch (e) {} }
      await new Promise(r => setTimeout(r, 80));   // 等版面穩定（不用 rAF：背景分頁或無頭瀏覽器可能不觸發）
      fitSlide();
      if (flat[i].type === 'divider') continue;
      const m = measureSlide();
      // [課堂版] 滑桿拖到不同值時也不可超出（每個滑桿取最多 12 個值，含兩端）；字級仍以初始畫面為準
      for (const r of slideEl.querySelectorAll('.visual-host input[type="range"]')) {
        const init = r.value, lo = +r.min, hi = +r.max;
        for (let k = 0; k <= 11; k++) {
          r.value = String(lo + (hi - lo) * k / 11);
          r.dispatchEvent(new Event('input', { bubbles: true }));
          if (window.MathJax && MathJax.typesetPromise) { try { await MathJax.typesetPromise([slideEl]); } catch (e) {} }
          await new Promise(res => setTimeout(res, 30));
          fitSlide();
          (window.MRD_OVERFLOW[i] || []).forEach(w => {
            const tag = `${w}（滑桿值 ${r.value}）`;
            if (!m.overflow.includes(w) && !m.overflow.includes(tag)) m.overflow.push(tag);
          });
        }
        r.value = init;
        r.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const s = flat[i];
      report.push(Object.assign({ page: i + 1, sec: s.sec, title: s.title }, m));
      const bad = [];
      if (m.overflow.length) bad.push('超出：' + m.overflow.join('、'));
      if (m.small.length) bad.push(`小於 28pt ${m.small.length} 處：` + m.small.slice(0, 4).join('；') + (m.small.length > 4 ? '…' : ''));
      if (m.merr) bad.push('MathJax 錯誤 ' + m.merr);
      if (m.raw) bad.push('殘留 TeX ' + m.raw);
      if (m.failed) bad.push('視覺載入失敗');
      rows.push(`${bad.length ? '✗' : '✓'} 第 ${i + 1} 頁 ${s.sec}「${String(s.title).replace(/<[^>]*>/g, '').slice(0, 20)}」` + (bad.length ? '\n    ' + bad.join('\n    ') : ''));
    }
    window.MRD_REPORT = { viewport: [window.innerWidth, window.innerHeight], pages: report,
      fail: report.filter(p => p.overflow.length || p.small.length || p.merr || p.raw || p.failed).length };
    const box = document.createElement('div');
    box.className = 'mrd-check-report';
    box.textContent = `檢查模式（視窗 ${window.innerWidth}×${window.innerHeight}；只代表目前視窗大小，不檢查數學正確性）\n` +
      `內容頁 ${report.length} 頁，有問題 ${window.MRD_REPORT.fail} 頁\n\n` + rows.join('\n');
    document.body.appendChild(box);
    // [本機新增] 供 validate_deck.py 讀取的機器可讀結果（< 轉義，避免標題文字打斷 script 標籤）
    const js = document.createElement('script');
    js.type = 'application/json'; js.id = 'mrd-check-json';
    js.textContent = JSON.stringify(window.MRD_REPORT).replace(/</g, '\\u003c');
    document.body.appendChild(js);
    document.title = 'CHECK-DONE ' + document.title;
  }
  if (/[?&]check\b/.test(location.search)) runCheck();
  // 不自動 render，等按「開始複習」；但若直接想看也可預先 render
})();
