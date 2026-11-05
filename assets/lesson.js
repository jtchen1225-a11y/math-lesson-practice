/* ============================================================
   lesson.js — 40 分鐘數學課堂元件（課堂版新增）
   在 visual(h) 內呼叫，h 為 .visual-host。所有元件只寫入 h，不碰其他頁。
   內容字串可含 HTML 與行內數學 \( \)；元件會在顯示新內容後呼叫 MJ() 重新排版。
   操作按鈕都帶 class="ls-ui"（?check 不把按鈕當教學文字量字級）；教學文字一律 28pt。

   LS.goals(h, {head, items, note})               學習目標／本節總結卡
   LS.tasks(h, tiers, {timer})                     A／B／C 三層同頁顯示＋各自的提示階梯與答案；timer＝分鐘時頂端加倒數
   LS.check(h, {q, options, tally})                全班同步作答的理解檢查（可計票、揭曉迷思）
   LS.mistake(h, {who, q, steps, wrong, why, fix}) 典型錯誤分析（不公開學生身份）
   LS.timer(h, {min, label, tips})                 單獨的倒數計時頁（分層練習請用 tasks 的 timer）
   LS.exit(h, {q, ans, rubric})                    出口題＋參考答案（rubric 不投影，只出現在教師版紙本）
   LS.tally(h, {q, levels})                        自評／舉手統計
   LS.summary(h, {head, items})                    本節核心知識小結（每份簡報的最後一頁）
   LS.tiers(h, tiers)                              A／B／C 三層題目一覽（只看題目，不含提示與答案）
   LS.hook(h, {story, pic, video, guess, ask})     懸念引入：情境圖或短片＋故事＋先猜＋懸念問題
   LS.anim(h, {scenes, vb})                        分幕動畫＋字幕＋預錄語音（例：粵語旁白）

   拆頁（內容放不下時用，絕不縮字）：tasks、check、mistake、exit 都接受 stage
     stage:'ask'      題目頁：只放題目，不放提示、答案、解說
     stage:'explain'  解說頁：放提示、答案或解說；紙本只讀 ask 頁，不會重複
   ============================================================ */
(function () {
  const TIER = {
    A: { name: '基礎支持', color: '#059669' },
    B: { name: '核心達標', color: '#2563eb' },
    C: { name: '延伸挑戰', color: '#7c3aed' },
  };
  const typeset = el => { if (typeof window.MJ === 'function') window.MJ(el); };
  const $$ = (h, sel) => Array.prototype.slice.call(h.querySelectorAll(sel) || []);
  const toggle = (el, on) => { if (el && el.classList) el.classList.toggle('show', on); };

  function goals(h, o) {
    o = o || {};
    h.innerHTML = `<div class="ls ls-goals">
      ${o.head ? `<div class="ls-head">${o.head}</div>` : ''}
      <ul class="ls-list">${(o.items || []).map(t => `<li>${t}</li>`).join('')}</ul>
      ${o.note ? `<div class="ls-note">${o.note}</div>` : ''}
    </div>`;
  }

  // ---- 課堂狀態：換頁回來時還原（票數、提示、答案、倒數）。存在本分頁的 sessionStorage，關掉分頁就清除；只記人數，不記姓名 ----
  const STORE_KEY = 'mrd-lesson:' + (typeof document !== 'undefined' ? document.title : '');
  let STATE = {};
  try { if (!/[?&](check|validate)\b/.test(location.search)) STATE = JSON.parse(window.sessionStorage.getItem(STORE_KEY)) || {}; } catch (e) { STATE = {}; }
  const saveState = () => { try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(STATE)); } catch (e) {} };
  // 目前這一頁（engine.js 繪製前設定 MRD_SLIDE_KEY）某個元件的狀態
  const slot = name => { const k = (window.MRD_SLIDE_KEY || '_') + '/' + name; return STATE[k] || (STATE[k] = {}); };

  // 計票按鈕：票數存進 st，回傳歸零函式
  function bindVotes(h, st, q, labels, onChange) {
    const btns = $$(h, '.ls-count');
    st.vote = true; st.sec = window.MRD_SLIDE_KEY || ''; st.q = q; st.labels = labels;
    st.counts = labels.map((_, i) => (st.counts && st.counts[i]) || 0);
    const paint = () => {
      btns.forEach((b, i) => { b.textContent = String(st.counts[i]); });
      if (onChange) onChange(st.counts);
    };
    btns.forEach((b, i) => { b.onclick = () => { st.counts[i]++; saveState(); paint(); }; });
    paint();
    return () => { st.counts = labels.map(() => 0); saveState(); paint(); };
  }

  // ---- 時間到提示音（Web Audio，不需音效檔）；瀏覽器規定要先有點擊，所以在按「開始」時啟用 ----
  let audioCtx = null;
  const bellTimers = {};
  function armAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !audioCtx) audioCtx = new AC();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
  }
  function ring() {
    if (STATE.bellOff) return;
    window.MRD_RINGS = (window.MRD_RINGS || 0) + 1;
    if (!audioCtx) return;
    try {
      [0, 0.35, 0.7].forEach(t => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), at = audioCtx.currentTime + t;
        o.frequency.value = 880; g.gain.value = 0.25;
        o.connect(g); g.connect(audioCtx.destination);
        o.start(at); o.stop(at + 0.22);
      });
    } catch (e) {}
  }

  // 倒數計時：回傳 HTML 與綁定函式；以結束時刻計算，換頁後繼續倒數，時間到照樣響鈴
  function clockParts(min) {
    const total = Math.max(1, Math.round((+min || 5) * 60));
    const html = `<span class="ls-clock">0:00</span>
      <button class="ls-btn ls-ui" data-act="go">開始</button>
      <button class="ls-btn ls-ui" data-act="reset">重設</button>
      <button class="ls-btn ls-ui" data-act="bell" title="時間到響鈴／靜音" aria-label="時間到響鈴或靜音">🔔</button>`;
    const bind = (h, root) => {
      const st = slot('clock'), key = window.MRD_SLIDE_KEY || '_';
      if (st.left === undefined) st.left = total;
      const clock = root.querySelector('.ls-clock'), go = root.querySelector('[data-act="go"]'), bell = root.querySelector('[data-act="bell"]');
      const remain = () => (st.endAt ? Math.max(0, Math.ceil((st.endAt - Date.now()) / 1000)) : st.left);
      const finish = () => { st.left = 0; st.endAt = null; saveState(); };
      let tid = null;
      const paint = () => {
        const left = remain();
        clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        root.classList.toggle('done', left === 0);
        go.textContent = !left ? '時間到' : st.endAt ? '暫停' : st.left < total ? '繼續' : '開始';
        bell.textContent = STATE.bellOff ? '🔕' : '🔔';
      };
      const tick = () => {
        if (tid) clearInterval(tid);
        tid = setInterval(() => {
          if (!h.isConnected) { clearInterval(tid); return; }   // 換頁只停止畫面更新，倒數本身不停
          paint();
          if (!st.endAt) clearInterval(tid);
        }, 500);
      };
      const arm = () => {
        if (bellTimers[key]) clearTimeout(bellTimers[key]);
        bellTimers[key] = setTimeout(() => { finish(); ring(); }, Math.max(0, st.endAt - Date.now()));
      };
      go.onclick = () => {
        armAudio();
        const left = remain();
        if (st.endAt) {
          st.left = left; st.endAt = null;
          if (bellTimers[key]) clearTimeout(bellTimers[key]);
        } else if (left) {
          st.endAt = Date.now() + left * 1000;
          arm(); tick();
        }
        saveState(); paint();
      };
      root.querySelector('[data-act="reset"]').onclick = () => {
        if (bellTimers[key]) clearTimeout(bellTimers[key]);
        st.left = total; st.endAt = null; saveState(); paint();
      };
      bell.onclick = () => { armAudio(); STATE.bellOff = !STATE.bellOff; saveState(); paint(); };
      if (st.endAt) {
        if (st.endAt <= Date.now()) finish();      // 重新整理前就已到時
        else { if (!bellTimers[key]) arm(); tick(); }
      }
      paint();
    };
    return { html, bind };
  }

  // A／B／C 三層同一頁顯示；每張卡各有提示階梯與答案。opt.timer＝分鐘數時，頂端加倒數計時（專注時間）。
  function tasks(h, tiers, opt) {
    tiers = tiers || [];
    opt = opt || {};
    const ck = opt.timer ? clockParts(opt.timer) : null;
    h.innerHTML = `<div class="ls ls-tasks">
      ${ck ? `<div class="ls-clockbar ls-ui">⏱ ${opt.label || '專注時間'}　${ck.html}</div>` : ''}
      ${tiers.map((t, i) => {
      const T = TIER[t.tier] || TIER.B, hints = t.hints || [];
      return `<div class="ls-card show" data-i="${i}" style="--tc:${T.color}">
        <div class="ls-card-head">
          <span class="ls-tier-head ls-ui"><span class="ls-tier-key">${t.tier}</span>${t.name || T.name}</span>
          <span class="ls-actions ls-ui">
            ${hints.length ? `<button class="ls-btn ls-ui" data-act="hint">提示 0／${hints.length}</button>` : ''}
            ${t.ans ? `<button class="ls-btn ls-ui" data-act="ans">答案</button>` : ''}
          </span>
        </div>
        <div class="ls-tier-q">${t.q}</div>
        ${hints.length ? `<ol class="ls-hints">${hints.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}
        ${t.ans ? `<div class="ls-ans">答：${t.ans}</div>` : ''}
      </div>`;
    }).join('')}</div>`;
    if (ck) ck.bind(h, h.querySelector('.ls-clockbar'));
    if (opt.stage === 'ask') { $$(h, '.ls-card .ls-actions, .ls-hints, .ls-ans').forEach(x => x.remove()); return; }
    const cst = slot('cards');
    cst.list = cst.list || [];
    $$(h, '.ls-card').forEach((c, i) => {
      const s = cst.list[i] || (cst.list[i] = { n: 0, ans: false });
      const hints = $$(c, '.ls-hints li'), hb = c.querySelector('[data-act="hint"]');
      const paintHints = () => {
        hints.forEach((x, k) => toggle(x, k < s.n));
        if (hb) hb.textContent = s.n < hints.length ? `提示 ${s.n}／${hints.length}` : '收起提示';
      };
      if (hb && hints.length) {
        hb.onclick = () => {
          s.n = s.n < hints.length ? s.n + 1 : 0;
          saveState(); paintHints();
          if (s.n) typeset(hints[s.n - 1]);
        };
        paintHints();
      }
      const ab = c.querySelector('[data-act="ans"]'), ans = c.querySelector('.ls-ans');
      if (ab && ans) {
        const paintAns = () => { toggle(ans, s.ans); ab.textContent = s.ans ? '收起答案' : '答案'; };
        ab.onclick = () => { s.ans = !s.ans; saveState(); paintAns(); if (s.ans) typeset(ans); };
        paintAns();
      }
    });
  }

  function check(h, o) {
    o = o || {};
    const opts = o.options || [];
    const L = 'ABCDEFGH';
    if (o.stage === 'explain') {
      // 解說頁：直接顯示對錯與原因，沒有計票與按鈕；only 可只列部分選項（字母不變），q 省略時不顯示題目
      const only = o.only || opts.map((_, i) => i);
      h.innerHTML = `<div class="ls ls-check revealed">
        ${o.q ? `<div class="ls-q">${o.q}</div>` : ''}
        <div class="ls-opts">${only.map(i => `<div class="ls-opt${opts[i].ok ? ' ok' : ''}">
          <span class="ls-key">${L[i]}</span><span class="ls-ot">${opts[i].t}</span>
          ${opts[i].why ? `<div class="ls-why">${opts[i].why}</div>` : ''}
        </div>`).join('')}</div>
      </div>`;
      return;
    }
    h.innerHTML = `<div class="ls ls-check">
      <div class="ls-q">${o.q}</div>
      <div class="ls-opts">${opts.map((x, i) => `<div class="ls-opt" data-i="${i}">
        <span class="ls-key">${L[i]}</span><span class="ls-ot">${x.t}</span>
        ${o.tally !== false ? `<button class="ls-count ls-ui" data-i="${i}" title="點一下＋1">0</button>` : ''}
        ${x.why && o.stage !== 'ask' ? `<div class="ls-why">${x.why}</div>` : ''}
      </div>`).join('')}</div>
      <div class="ls-actions ls-ui">
        <button class="ls-btn ls-ui" data-act="reveal">揭曉</button>
        ${o.tally !== false ? '<button class="ls-btn ls-ui" data-act="reset">票數歸零</button>' : ''}
      </div>
    </div>`;
    const st = slot('check');
    const resetVotes = o.tally !== false ? bindVotes(h, st, o.q, opts.map((x, i) => `${L[i]}. ${x.t}`)) : null;
    st.ok = opts.map(x => !!x.ok);
    const rb = h.querySelector('[data-act="reveal"]'), root = h.querySelector('.ls-check');
    const paint = () => {
      root.classList.toggle('revealed', !!st.revealed);
      $$(h, '.ls-opt').forEach((el, i) => el.classList.toggle('ok', !!st.revealed && !!(opts[i] || {}).ok));
      if (rb) rb.textContent = st.revealed ? '收起' : '揭曉';
    };
    if (rb) rb.onclick = () => { st.revealed = !st.revealed; saveState(); paint(); if (st.revealed) typeset(h); };
    const zb = h.querySelector('[data-act="reset"]');
    if (zb && resetVotes) zb.onclick = resetVotes;
    paint();
  }

  function mistake(h, o) {
    o = o || {};
    const steps = o.steps || [];
    const ask = o.stage === 'ask', explain = o.stage === 'explain';
    h.innerHTML = `<div class="ls ls-mistake">
      <div class="ls-tag">${o.who || '某位同學的解法（不公開姓名）'}</div>
      ${o.q ? `<div class="ls-q">${o.q}</div>` : ''}
      <ol class="ls-steps">${steps.map((t, i) => `<li data-i="${i}">${t}</li>`).join('')}</ol>
      ${o.why && !ask ? `<div class="ls-why ls-box">${o.why}</div>` : ''}
      ${o.fix && !ask ? `<div class="ls-fix ls-box">${Array.isArray(o.fix) ? o.fix.join('<br>') : o.fix}</div>` : ''}
      ${explain ? '' : `<div class="ls-actions ls-ui">
        <button class="ls-btn ls-ui" data-act="find">標出錯誤</button>
        ${o.fix && !ask ? '<button class="ls-btn ls-ui" data-act="fix">看修正</button>' : ''}
      </div>`}
    </div>`;
    if (explain) {
      // 解說頁：直接標出錯誤並顯示原因與修正；省略 steps、why 或 fix 可再拆成多頁
      h.querySelector('.ls-mistake').classList.add('found', 'fixed');
      $$(h, '.ls-steps li').forEach((li, i) => li.classList.toggle('bad', i === o.wrong));
      return;
    }
    const st = slot('mistake');
    const root = h.querySelector('.ls-mistake'), fb = h.querySelector('[data-act="find"]'), xb = h.querySelector('[data-act="fix"]');
    const paint = () => {
      root.classList.toggle('found', !!st.found);
      root.classList.toggle('fixed', !!st.fixed);
      $$(h, '.ls-steps li').forEach((li, i) => li.classList.toggle('bad', !!st.found && i === o.wrong));
      if (fb) fb.textContent = st.found ? '取消標示' : '標出錯誤';
      if (xb) xb.textContent = st.fixed ? '收起修正' : '看修正';
    };
    if (fb) fb.onclick = () => { st.found = !st.found; saveState(); paint(); if (st.found) typeset(h); };
    if (xb) xb.onclick = () => { st.fixed = !st.fixed; saveState(); paint(); if (st.fixed) typeset(h); };
    paint();
  }

  function timer(h, o) {
    o = o || {};
    // 單獨的計時頁；分層練習要計時時，請改用 LS.tasks(h, tiers, {timer: 分鐘})，讓題目和時間在同一頁
    const ck = clockParts(o.min);
    h.innerHTML = `<div class="ls ls-timer">
      ${o.label ? `<div class="ls-head">${o.label}</div>` : ''}
      <div class="ls-clockwrap">${ck.html}</div>
      ${o.tips ? `<ul class="ls-list ls-tips">${o.tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    </div>`;
    ck.bind(h, h.querySelector('.ls-timer'));
  }

  // 懸念引入：情境圖（pic，SVG／HTML）或短片（video，本機檔案路徑）＋故事，學生先猜，最後丟出懸念問題（不給答案）。
  // o = {story, pic, video, poster, guess:['猜測選項'], ask:'懸念問題', later:'學完就知道…'}
  function hook(h, o) {
    o = o || {};
    const media = o.video
      ? `<video class="ls-video" src="${o.video}" ${o.poster ? `poster="${o.poster}"` : ''} controls preload="metadata" playsinline></video>`
      : (o.pic || '');
    const L = 'ABCDEFGH', guess = o.guess || [];
    const views = [];
    if (media || o.story) views.push(['👀 看情境', `${media ? `<div class="ls-stage">${media}</div>` : ''}${o.story ? `<div class="ls-story">${o.story}</div>` : ''}`]);
    if (guess.length) views.push(['🤔 猜一猜', `${o.story ? `<div class="ls-story">${o.story}</div>` : ''}<div class="ls-opts">${guess.map((g, i) => `<div class="ls-opt">
        <span class="ls-key">${L[i]}</span><span class="ls-ot">${g}</span>
        <button class="ls-count ls-ui" title="點一下＋1">0</button></div>`).join('')}</div>`]);
    views.push(['❓ 懸念登場', `<div class="ls-ask"><div class="ls-ask-q">❓ ${o.ask || ''}</div>${o.later ? `<div class="ls-ask-later">${o.later}</div>` : ''}</div>`]);
    // 一次只顯示一步：看情境 → 猜一猜 → 懸念登場（懸念不給答案）
    h.innerHTML = `<div class="ls ls-hook">
      ${views.map((x, i) => `<div class="ls-view" data-i="${i}">${x[1]}</div>`).join('')}
      <div class="ls-actions ls-ui">${views.map((x, i) => `<button class="ls-btn ls-ui" data-step="${i}">${x[0]}</button>`).join('')}</div>
    </div>`;
    const st = slot('hook');
    if (guess.length) bindVotes(h, st, o.ask || o.story || '懸念猜測', guess.map((g, i) => `${L[i]}. ${g}`));
    const vs = $$(h, '.ls-view'), bs = $$(h, '[data-step]');
    const show = k => {
      vs.forEach((el, i) => toggle(el, i === k));
      bs.forEach((x, i) => x.classList.toggle('active', i === k));
    };
    bs.forEach((b, k) => {
      b.onclick = () => { st.step = k; saveState(); show(k); typeset(vs[k]); };
    });
    show(Math.min(st.step || 0, views.length - 1));
    const v = h.querySelector('.ls-video');
    if (v) {   // 換頁後停止短片
      const t = setInterval(() => { if (!h.isConnected) { v.pause(); clearInterval(t); } }, 500);
    }
  }

  // 出口題：投影畫面只有題目與參考答案。rubric（判準與下一節安排）這裏不顯示，只印在教師版紙本，避免標籤學生。
  function exit(h, o) {
    o = o || {};
    if (o.stage === 'explain') {
      h.innerHTML = `<div class="ls ls-exit">
        ${o.q ? `<div class="ls-q">${o.q}</div>` : ''}
        <div class="ls-ans show">答：${o.ans || ''}</div>
      </div>`;
      return;
    }
    if (o.stage === 'ask') {
      h.innerHTML = `<div class="ls ls-exit">
        <div class="ls-tag">出口挑戰（獨立完成，約 2～3 分鐘）</div>
        <div class="ls-q">${o.q}</div>
      </div>`;
      return;
    }
    h.innerHTML = `<div class="ls ls-exit">
      <div class="ls-tag">出口挑戰（獨立完成，約 2～3 分鐘）</div>
      <div class="ls-q">${o.q}</div>
      ${o.ans ? `<div class="ls-ans">答：${o.ans}</div>` : ''}
      <div class="ls-actions ls-ui">
        ${o.ans ? '<button class="ls-btn ls-ui" data-act="ans">參考答案</button>' : ''}
      </div>
    </div>`;
    const st = slot('exit');
    const ab = h.querySelector('[data-act="ans"]'), ans = h.querySelector('.ls-ans');
    const paint = () => { toggle(ans, !!st.ans); if (ab) ab.textContent = st.ans ? '收起答案' : '參考答案'; };
    if (ab) ab.onclick = () => { st.ans = !st.ans; saveState(); paint(); if (st.ans) typeset(ans); };
    paint();
  }

  function tally(h, o) {
    o = o || {};
    const lv = o.levels || ['已掌握', '部分掌握', '尚未掌握'];
    const colors = ['#059669', '#d97706', '#e11d48', '#2563eb', '#7c3aed'];
    h.innerHTML = `<div class="ls ls-tally">
      ${o.q ? `<div class="ls-q">${o.q}</div>` : ''}
      ${lv.map((t, i) => `<div class="ls-trow" style="--rc:${colors[i % colors.length]}">
        <span class="ls-tl">${t}</span>
        <span class="ls-bar"><i style="width:0%"></i></span>
        <button class="ls-count ls-ui" data-i="${i}" title="點一下＋1">0</button>
      </div>`).join('')}
      <div class="ls-actions ls-ui"><button class="ls-btn ls-ui" data-act="reset">歸零</button></div>
    </div>`;
    const bars = $$(h, '.ls-bar i');
    const resetVotes = bindVotes(h, slot('tally'), o.q || '自我評估', lv, n => {
      const max = Math.max(1, ...n);
      bars.forEach((b, i) => { b.style.width = (n[i] / max * 100) + '%'; });
    });
    const zb = h.querySelector('[data-act="reset"]');
    if (zb) zb.onclick = resetVotes;
  }

  // ---- 課堂紀錄：列出本節各題票數，可下載 CSV（只有人數，沒有姓名）----
  const plain = s => String(s).replace(/<[^>]*>/g, '').replace(/\\[()]/g, '');
  const voteRows = () => Object.keys(STATE).map(k => STATE[k])
    .filter(x => x && x.vote && x.counts && x.counts.some(Boolean))
    .sort((a, b) => String(a.sec).localeCompare(String(b.sec), undefined, { numeric: true }));
  function downloadCsv(rows) {
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['頁面', '問題', '選項', '人數', '正解'].map(q).join(',')];
    rows.forEach(r => r.labels.forEach((l, i) => lines.push([r.sec, plain(r.q), plain(l), r.counts[i], r.ok ? (r.ok[i] ? '是' : '否') : ''].map(q).join(','))));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `課堂紀錄-${document.title}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function report() {
    const old = document.getElementById('lsReport');
    if (old) { old.remove(); return; }
    const rows = voteRows();
    const box = document.createElement('div');
    box.id = 'lsReport'; box.className = 'ls-report';
    box.innerHTML = `<div class="ls-report-body">
      <h2>本節課堂紀錄</h2>
      <p>只有人數，沒有姓名。資料留在這個瀏覽器分頁，關掉分頁就會清除。</p>
      ${rows.length ? `<table><thead><tr><th>頁面</th><th>問題</th><th>各選項人數</th></tr></thead><tbody>${rows.map(r => `<tr>
        <td>${r.sec}</td><td>${r.q}</td>
        <td>${r.labels.map((l, i) => `<div>${l}：<b>${r.counts[i]}</b></div>`).join('')}</td></tr>`).join('')}</tbody></table>` : '<p><b>還沒有任何票數。</b></p>'}
      <div class="ls-report-actions">
        ${rows.length ? '<button class="ls-btn" data-act="csv">下載 CSV</button>' : ''}
        <button class="ls-btn" data-act="clear">清除本節紀錄</button>
        <button class="ls-btn" data-act="close">關閉</button>
      </div></div>`;
    document.body.appendChild(box);
    typeset(box);
    box.querySelector('[data-act="close"]').onclick = () => box.remove();
    const csv = box.querySelector('[data-act="csv"]');
    if (csv) csv.onclick = () => downloadCsv(rows);
    box.querySelector('[data-act="clear"]').onclick = () => {
      if (!window.confirm('清除本節的票數、提示與倒數狀態？清除後無法復原。')) return;
      Object.keys(bellTimers).forEach(k => { clearTimeout(bellTimers[k]); delete bellTimers[k]; });
      STATE = {}; saveState();
      box.remove();
      if (typeof window.MRD_RERENDER === 'function') window.MRD_RERENDER();
    };
  }
  if (typeof document !== 'undefined') {
    const rb = document.getElementById('dkReport');
    if (rb) rb.onclick = report;
  }

  // 本節核心知識小結：每份簡報的最後一頁，只放這節課最重要的 3～4 點知識
  function summary(h, o) {
    o = o || {};
    h.innerHTML = `<div class="ls ls-summary">
      <div class="ls-head">${o.head || '本節核心知識'}</div>
      <ol class="ls-sum-list">${(o.items || []).map(t => `<li><span>${t}</span></li>`).join('')}</ol>
    </div>`;
  }

  function tiers(h, list) {
    h.innerHTML = `<div class="ls ls-tiers">${(list || []).map(t => {
      const T = TIER[t.tier] || TIER.B;
      return `<div class="ls-tier" style="--tc:${T.color}">
        <div class="ls-tier-head"><span class="ls-tier-key">${t.tier}</span>${t.name || T.name}${t.fit ? `<span class="ls-tier-fit">｜${t.fit}</span>` : ''}</div>
        <div class="ls-tier-q">${t.q}</div>
      </div>`;
    }).join('')}</div>`;
  }

  // 分幕動畫：scenes=[{say:'字幕', audio:'audio/s1.mp3', dur:秒, d:k=>'SVG 片段'}]，k 為該幕 0～1 的進度。
  // 前面各幕以 d(1) 疊加；進度條可拖曳（驗證工具會掃描它）。有 audio 就播預錄語音並等它講完；
  // 沒有 audio 時，若瀏覽器有對應語言（opt.lang，預設 zh-HK）的語音就朗讀字幕，否則只顯示字幕。
  function anim(h, o) {
    o = o || {};
    const sc = o.scenes || [], N = sc.length, lang = o.lang || 'zh-HK';
    h.innerHTML = `<div class="ls ls-anim">
      <div class="ls-stage"><svg viewBox="${o.vb || '0 0 440 250'}" style="max-width:100%"><g class="ls-ag"></g></svg></div>
      <div class="ls-sub"></div>
      <div class="ls-actions ls-ui">
        <button class="ls-btn ls-ui" data-act="play">▶ 播放</button>
        <button class="ls-btn ls-ui" data-act="sound">🔊 聲音：開</button>
        <input class="ls-anim-r ls-ui" type="range" min="0" max="${N}" step="0.01" value="0" aria-label="動畫進度">
      </div></div>`;
    const g = h.querySelector('.ls-ag'), sub = h.querySelector('.ls-sub'), r = h.querySelector('.ls-anim-r');
    const pb = h.querySelector('[data-act="play"]'), sb = h.querySelector('[data-act="sound"]');
    const at = v => { const i = Math.max(0, Math.min(N - 1, Math.floor(v))); return [i, Math.max(0, Math.min(1, v - i))]; };
    const draw = () => {
      if (!N) return;
      const [i, k] = at(+r.value);
      let s = '';
      for (let j = 0; j < i; j++) if (sc[j].d) s += sc[j].d(1);
      if (sc[i].d) s += sc[i].d(k);
      g.innerHTML = s;
      sub.innerHTML = sc[i].say || '';
    };
    let playing = false, raf = null, cur = 0, t0 = 0, sound = true, audio = null, voiceDone = true;
    const stopVoice = () => {
      if (audio) { audio.pause(); audio = null; }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      voiceDone = true;
    };
    const speak = i => {
      stopVoice();
      if (!sound) return;
      const s = sc[i];
      if (s.audio) {
        audio = new Audio(s.audio); voiceDone = false;
        audio.onended = audio.onerror = () => { voiceDone = true; };
        audio.play().catch(() => { voiceDone = true; });
      } else if (window.speechSynthesis) {
        const v = window.speechSynthesis.getVoices().find(x => x.lang && x.lang.toLowerCase().startsWith(lang.toLowerCase()));
        if (!v) return;
        const u = new SpeechSynthesisUtterance(String(s.speak || s.say || '').replace(/<[^>]*>/g, ''));
        u.voice = v; u.lang = v.lang; voiceDone = false;
        u.onend = u.onerror = () => { voiceDone = true; };
        window.speechSynthesis.speak(u);
      }
    };
    const dur = i => Math.max(0.5, +sc[i].dur || 4) * 1000;
    const startScene = (i, k = 0) => { cur = i; t0 = performance.now() - k * dur(i); speak(i); };
    const pause = () => {
      playing = false; if (raf) clearTimeout(raf); raf = null; stopVoice();
      pb.textContent = +r.value >= N ? '▶ 再看一次' : '▶ 播放';
    };
    const tick = now => {
      if (!h.isConnected) { pause(); return; }   // 換頁後停止動畫與聲音
      const p = Math.min(1, (now - t0) / dur(cur));
      r.value = String(cur + Math.min(p, 0.999)); draw();
      if (p >= 1 && voiceDone) {
        if (cur + 1 < N) startScene(cur + 1);
        else { r.value = String(N); draw(); pause(); return; }
      }
      raf = setTimeout(() => tick(performance.now()), 33);   // 用計時器而非 rAF：視窗在背景時仍會前進
    };
    pb.onclick = () => {
      if (playing) { pause(); return; }
      if (!N) return;
      if (+r.value >= N) r.value = '0';
      const [i, k] = at(+r.value);
      playing = true; pb.textContent = '❚❚ 暫停';
      startScene(i, k); tick(performance.now());
    };
    sb.onclick = () => { sound = !sound; sb.textContent = sound ? '🔊 聲音：開' : '🔇 聲音：關'; if (!sound) stopVoice(); };
    r.addEventListener('input', e => { if (e.isTrusted && playing) pause(); draw(); });
    draw();
  }

  window.LS = { report, goals, summary, tasks, check, mistake, timer, exit, tally, tiers, anim, hook, TIER };
})();
