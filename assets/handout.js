/* ============================================================
   handout.js — 可列印的紙本（課堂版新增），由 handout.html 載入。
   直接讀投影片同一份 chN.js，題目不用寫兩次：
   - 學生學習單：各分層任務頁的 A／B／C 題目與作答空間（A 層附第一條提示；沒有答案）
   - 出口小紙條：一張 A4 六張，裁開後派發
   - 延遲檢測小紙條：LS.exit 的 delayed（約一週後派發，不提前通知）
   - 教師版：答案、提示、巡視觀察表（opt.watch）、出口題判準（rubric）、延遲檢測答案與判讀
   教師版不要投影或派發給學生。
   網址加 ?mode=student／slips／delayed／teacher 只顯示該部分；加 ?check 時輸出檢查結果供 validate_deck.py 讀取。
   ============================================================ */
(function () {
  const TIER = { A: { name: '基礎支持', color: '#059669' }, B: { name: '核心達標', color: '#2563eb' }, C: { name: '延伸挑戰', color: '#7c3aed' } };
  const noop = () => {};
  const got = [];
  let cur = null;
  window.LS = {
    goals: noop, summary: noop, check: noop, mistake: noop, timer: noop, hook: noop, tally: noop, tiers: noop, anim: noop, TIER,
    // stage:'explain' 是投影用的解說頁，題目已由 ask 頁提供，紙本不重複
    tasks: (h, tiers, opt) => { if ((opt || {}).stage !== 'explain') got.push({ kind: 'tasks', slide: cur, tiers: tiers || [], opt: opt || {} }); },
    exit: (h, o) => { if ((o || {}).stage !== 'explain') got.push({ kind: 'exit', slide: cur, o: o || {} }); },
  };
  (window.DECK || []).forEach(chap => (chap.slides || []).forEach(s => {
    cur = s;
    if (typeof s.visual !== 'function') return;
    try { s.visual(document.createElement('div')); } catch (e) { /* 非課堂元件頁（滑桿、步驟）不影響紙本 */ }
  }));

  const taskPages = got.filter(x => x.kind === 'tasks');
  const exits = got.filter(x => x.kind === 'exit');
  const head = t => `<div class="ho-head"><h1>${window.HANDOUT.topic}</h1><div class="ho-sub">${window.HANDOUT.grade}｜${t}</div></div>`;
  const who = '<div class="ho-who">班別：________　學號：______</div>';
  const label = t => { const T = TIER[t.tier] || TIER.B; return `<span class="ho-key" style="--tc:${T.color}">${t.tier}</span><b style="color:${T.color}">${t.name || T.name}</b>`; };

  const student = `<section class="ho-sec" data-part="student">
    ${head('學習單')}${who}
    ${taskPages.map(p => `<div class="ho-page-block">
      <h2>${p.slide.sec} ${p.slide.secName}${p.opt.timer ? `<small>（專注 ${p.opt.timer} 分鐘）</small>` : ''}</h2>
      <p class="ho-tip">選一層開始，做完往上挑戰。</p>
      ${p.tiers.map(t => `<div class="ho-task">
        <div class="ho-task-head">${label(t)}</div>
        <div class="ho-q">${t.q}</div>
        ${t.tier === 'A' && (t.hints || []).length ? `<div class="ho-hint">提示：${t.hints[0]}</div>` : ''}
        <div class="ho-space"></div>
      </div>`).join('')}
    </div>`).join('')}
  </section>`;

  const slip = o => `<div class="ho-slip"><div class="ho-slip-head"><b>出口挑戰</b>${who}</div><div class="ho-q">${o.q}</div><div class="ho-space"></div></div>`;
  const slips = exits.length ? `<section class="ho-sec" data-part="slips">
    ${exits.map(x => `<div class="ho-slips">${Array(6).fill(slip(x.o)).join('')}</div>`).join('')}
  </section>` : '';

  const delayedOf = exits.filter(x => x.o.delayed);
  const slipD = o => `<div class="ho-slip"><div class="ho-slip-head"><b>小測一下（不計分）</b>${who}</div><div class="ho-q">${o.q}</div><div class="ho-space"></div></div>`;
  const delayed = delayedOf.length ? `<section class="ho-sec" data-part="delayed">
    ${delayedOf.map(x => `<div class="ho-slips">${Array(6).fill(slipD(x.o.delayed)).join('')}</div>`).join('')}
  </section>` : '';

  const RUB = [['已掌握', 'mastered', '#059669'], ['部分掌握', 'partial', '#d97706'], ['尚未掌握', 'notyet', '#e11d48']];
  const teacher = `<section class="ho-sec" data-part="teacher">
    ${head('教師版（不要投影或派發）')}
    ${taskPages.filter(p => (p.opt.watch || []).length).map(p => `<div class="ho-keep">
      <h2>巡視觀察表：${p.slide.sec} ${p.slide.secName}</h2>
      <p class="ho-tip">巡視時記人數即可（畫正字），不記姓名；選一個代表性錯誤用於下一階段。</p>
      <table><thead><tr><th>觀察重點</th><th class="ho-w">人數</th><th class="ho-w">用於錯誤分析</th></tr></thead><tbody>
      ${p.opt.watch.map(w => `<tr><td>${w}</td><td></td><td class="ho-c">☐</td></tr>`).join('')}
      <tr><td>其他：</td><td></td><td class="ho-c">☐</td></tr></tbody></table>
    </div>`).join('')}
    ${exits.map(x => `<div class="ho-keep"><h2>出口題判準</h2>
      <div class="ho-q">${x.o.q}</div>
      <p>參考答案：${x.o.ans || ''}</p>
      ${x.o.rubric ? `<table><thead><tr><th class="ho-w">結果</th><th>判準 → 下一節安排</th><th class="ho-w">人數</th></tr></thead><tbody>
      ${RUB.filter(r => x.o.rubric[r[1]]).map(r => `<tr><td style="color:${r[2]}"><b>${r[0]}</b></td><td>${x.o.rubric[r[1]]}</td><td></td></tr>`).join('')}</tbody></table>` : ''}
    </div>`).join('')}
    ${delayedOf.map(x => `<div class="ho-keep"><h2>延遲檢測（${x.o.delayed.when || '約一週後'}，不提前通知、不計分）</h2>
      <div class="ho-q">${x.o.delayed.q}</div>
      <p>參考答案：${x.o.delayed.ans || ''}</p>
      <table><thead><tr><th>出口題</th><th>延遲檢測</th><th>判斷</th><th class="ho-w">人數</th></tr></thead><tbody>
      <tr><td>已掌握</td><td>已掌握</td><td><b>真正掌握</b></td><td></td></tr>
      <tr><td>已掌握</td><td>未掌握</td><td><b>短暫學會</b>：增加間隔重現，改變情境再練</td><td></td></tr>
      <tr><td>未掌握</td><td>已掌握</td><td><b>延後學會</b>：了解哪些安排有效</td><td></td></tr>
      <tr><td>未掌握</td><td>未掌握</td><td><b>尚未掌握</b>：找出成因，小組或個別重建</td><td></td></tr></tbody></table>
    </div>`).join('')}
    <h2>答案與提示</h2>
    ${taskPages.map(p => `<div class="ho-keep"><h3>${p.slide.sec} ${p.slide.secName}</h3>
      <table><thead><tr><th class="ho-w">層</th><th>題目</th><th>提示</th><th class="ho-w">答案</th></tr></thead><tbody>
      ${p.tiers.map(t => `<tr><td>${label(t)}</td><td>${t.q}</td><td>${(t.hints || []).join('<br>')}</td><td>${t.ans || ''}</td></tr>`).join('')}</tbody></table></div>`).join('')}
  </section>`;

  const params = new URLSearchParams(location.search);
  document.getElementById('hoBody').innerHTML = student + slips + delayed + teacher;
  const setMode = m => { if (m) document.body.dataset.mode = m; else delete document.body.dataset.mode; };
  document.querySelectorAll('[data-print]').forEach(b => {
    b.onclick = () => { setMode(b.dataset.print); window.print(); };
  });
  window.addEventListener('afterprint', () => { if (!params.get('mode')) setMode(null); });
  setMode(params.get('mode'));

  const done = () => {
    if (!params.has('check')) return;
    const clone = document.getElementById('hoBody').cloneNode(true);
    clone.querySelectorAll('mjx-container, script').forEach(x => x.remove());
    const out = document.createElement('script');
    out.type = 'application/json'; out.id = 'ho-check-json';
    out.textContent = JSON.stringify({
      taskPages: taskPages.length, exits: exits.length, delayed: delayedOf.length, watch: taskPages.reduce((n, p) => n + (p.opt.watch || []).length, 0),
      rubric: exits.filter(x => x.o.rubric).length,
      rawTex: (clone.textContent.match(/\\\(|\\\)|\\frac|\\sqrt/g) || []).length,
      mathErrors: document.querySelectorAll('mjx-merror, [data-mjx-error]').length,
      studentHasAnswers: document.querySelector('[data-part="student"]').textContent.includes('答：'),
    }).replace(/</g, '\\u003c');
    document.body.appendChild(out);
    document.title = 'HANDOUT-DONE ' + document.title;
  };
  (function typesetWhenReady(n) {
    if (window.MathJax && MathJax.typesetPromise) MathJax.typesetPromise().then(done).catch(done);
    else if (n < 100) setTimeout(() => typesetWhenReady(n + 1), 100);
    else done();
  })(0);
})();
