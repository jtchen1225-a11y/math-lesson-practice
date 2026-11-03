/* ============================================================
   lesson.js — 40 分鐘數學課堂元件（課堂版新增）
   在 visual(h) 內呼叫，h 為 .visual-host。所有元件只寫入 h，不碰其他頁。
   內容字串可含 HTML 與行內數學 \( \)；元件會在顯示新內容後呼叫 MJ() 重新排版。
   操作按鈕都帶 class="ls-ui"（?check 不把按鈕當教學文字量字級）；教學文字一律 28pt。

   LS.goals(h, {head, items, note})               學習目標／本節總結卡
   LS.tasks(h, tiers, {start})                     A／B／C 分層任務＋提示階梯＋答案
   LS.check(h, {q, options, tally})                全班同步作答的理解檢查（可計票、揭曉迷思）
   LS.mistake(h, {who, q, steps, wrong, why, fix}) 典型錯誤分析（不公開學生身份）
   LS.timer(h, {min, label, tips})                 倒數計時（巡視時用）
   LS.exit(h, {q, ans, rubric})                    出口題＋三類學生判準與後續安排
   LS.tally(h, {q, levels})                        自評／舉手統計
   LS.tiers(h, tiers)                              A／B／C 三層題目同時顯示（讓學生選層）
   LS.anim(h, {scenes, vb})                        分幕動畫＋字幕＋預錄語音（例：粵語旁白）
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

  function tasks(h, tiers, opt) {
    tiers = tiers || [];
    opt = opt || {};
    const startIdx = Math.max(0, tiers.findIndex(t => t.tier === opt.start));
    const tabs = tiers.length > 1 ? `<div class="ls-tabs ls-ui">${tiers.map((t, i) =>
      `<button class="ls-tab ls-ui" data-i="${i}" style="--tc:${(TIER[t.tier] || TIER.B).color}">${t.tier} ${t.name || (TIER[t.tier] || {}).name || ''}</button>`).join('')}</div>` : '';
    h.innerHTML = `<div class="ls ls-tasks">${tabs}${tiers.map((t, i) => {
      const hints = t.hints || [];
      return `<div class="ls-card" data-i="${i}" style="--tc:${(TIER[t.tier] || TIER.B).color}">
        ${tiers.length === 1 && t.tier ? `<div class="ls-tag">${t.tier} ${t.name || (TIER[t.tier] || {}).name || ''}</div>` : ''}
        <div class="ls-q">${t.q}</div>
        ${hints.length ? `<ol class="ls-hints">${hints.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}
        ${t.ans ? `<div class="ls-ans">答：${t.ans}</div>` : ''}
        <div class="ls-actions ls-ui">
          ${hints.length ? `<button class="ls-btn ls-ui" data-act="hint">給提示 0／${hints.length}</button>` : ''}
          ${t.ans ? `<button class="ls-btn ls-ui" data-act="ans">顯示答案</button>` : ''}
        </div>
      </div>`;
    }).join('')}</div>`;
    const cards = $$(h, '.ls-card'), tabBtns = $$(h, '.ls-tab');
    const show = i => {
      cards.forEach((c, k) => toggle(c, k === i));
      tabBtns.forEach((b, k) => b.classList.toggle('active', k === i));
    };
    tabBtns.forEach((b, k) => { b.onclick = () => show(k); });
    cards.forEach(c => {
      const hints = $$(c, '.ls-hints li');
      let n = 0;
      const hb = c.querySelector('[data-act="hint"]');
      if (hb && hints.length) hb.onclick = () => {
        if (n < hints.length) { toggle(hints[n], true); typeset(hints[n]); n++; }
        else { n = 0; hints.forEach(x => toggle(x, false)); }
        hb.textContent = n < hints.length ? `給提示 ${n}／${hints.length}` : '收起提示';
      };
      const ab = c.querySelector('[data-act="ans"]'), ans = c.querySelector('.ls-ans');
      if (ab && ans) ab.onclick = () => {
        const on = !ans.classList.contains('show');
        toggle(ans, on); ab.textContent = on ? '收起答案' : '顯示答案'; if (on) typeset(ans);
      };
    });
    show(startIdx);
  }

  function check(h, o) {
    o = o || {};
    const opts = o.options || [];
    const L = 'ABCDEFGH';
    h.innerHTML = `<div class="ls ls-check">
      <div class="ls-q">${o.q}</div>
      <div class="ls-opts">${opts.map((x, i) => `<div class="ls-opt" data-i="${i}">
        <span class="ls-key">${L[i]}</span><span class="ls-ot">${x.t}</span>
        ${o.tally !== false ? `<button class="ls-count ls-ui" data-i="${i}" title="點一下＋1">0</button>` : ''}
        ${x.why ? `<div class="ls-why">${x.why}</div>` : ''}
      </div>`).join('')}</div>
      <div class="ls-actions ls-ui">
        <button class="ls-btn ls-ui" data-act="reveal">揭曉</button>
        ${o.tally !== false ? '<button class="ls-btn ls-ui" data-act="reset">票數歸零</button>' : ''}
      </div>
    </div>`;
    $$(h, '.ls-count').forEach(b => { b.onclick = () => { b.textContent = String(+b.textContent + 1); }; });
    const rb = h.querySelector('[data-act="reveal"]');
    if (rb) rb.onclick = () => {
      const on = !h.querySelector('.ls-check').classList.contains('revealed');
      h.querySelector('.ls-check').classList.toggle('revealed', on);
      $$(h, '.ls-opt').forEach((el, i) => el.classList.toggle('ok', on && !!(opts[i] || {}).ok));
      rb.textContent = on ? '收起' : '揭曉';
      if (on) typeset(h);
    };
    const zb = h.querySelector('[data-act="reset"]');
    if (zb) zb.onclick = () => $$(h, '.ls-count').forEach(b => { b.textContent = '0'; });
  }

  function mistake(h, o) {
    o = o || {};
    const steps = o.steps || [];
    h.innerHTML = `<div class="ls ls-mistake">
      <div class="ls-tag">${o.who || '某位同學的解法（不公開姓名）'}</div>
      ${o.q ? `<div class="ls-q">${o.q}</div>` : ''}
      <ol class="ls-steps">${steps.map((t, i) => `<li data-i="${i}">${t}</li>`).join('')}</ol>
      ${o.why ? `<div class="ls-why ls-box">${o.why}</div>` : ''}
      ${o.fix ? `<div class="ls-fix ls-box">${Array.isArray(o.fix) ? o.fix.join('<br>') : o.fix}</div>` : ''}
      <div class="ls-actions ls-ui">
        <button class="ls-btn ls-ui" data-act="find">標出錯誤</button>
        ${o.fix ? '<button class="ls-btn ls-ui" data-act="fix">看修正</button>' : ''}
      </div>
    </div>`;
    const root = h.querySelector('.ls-mistake');
    const fb = h.querySelector('[data-act="find"]');
    if (fb) fb.onclick = () => {
      const on = !root.classList.contains('found');
      root.classList.toggle('found', on);
      $$(h, '.ls-steps li').forEach((li, i) => li.classList.toggle('bad', on && i === o.wrong));
      fb.textContent = on ? '取消標示' : '標出錯誤';
      if (on) typeset(h);
    };
    const xb = h.querySelector('[data-act="fix"]');
    if (xb) xb.onclick = () => {
      const on = !root.classList.contains('fixed');
      root.classList.toggle('fixed', on);
      xb.textContent = on ? '收起修正' : '看修正';
      if (on) typeset(h);
    };
  }

  function timer(h, o) {
    o = o || {};
    const total = Math.max(1, Math.round((+o.min || 5) * 60));
    let left = total, tid = null;
    h.innerHTML = `<div class="ls ls-timer">
      ${o.label ? `<div class="ls-head">${o.label}</div>` : ''}
      <div class="ls-clock">0:00</div>
      <div class="ls-actions ls-ui">
        <button class="ls-btn ls-ui" data-act="go">開始</button>
        <button class="ls-btn ls-ui" data-act="reset">重設</button>
      </div>
      ${o.tips ? `<ul class="ls-list ls-tips">${o.tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    </div>`;
    const clock = h.querySelector('.ls-clock'), go = h.querySelector('[data-act="go"]'), root = h.querySelector('.ls-timer');
    const paint = () => {
      clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      root.classList.toggle('done', left === 0);
    };
    const stop = () => { if (tid) { clearInterval(tid); tid = null; } go.textContent = left ? '開始' : '時間到'; };
    go.onclick = () => {
      if (tid) { stop(); go.textContent = '繼續'; return; }
      if (!left) return;
      go.textContent = '暫停';
      tid = setInterval(() => {
        if (!h.isConnected) { stop(); return; }   // 換頁後 host 被移除就停止
        left = Math.max(0, left - 1); paint();
        if (!left) stop();
      }, 1000);
    };
    h.querySelector('[data-act="reset"]').onclick = () => { stop(); left = total; paint(); };
    paint();
  }

  function exit(h, o) {
    o = o || {};
    const r = o.rubric || {};
    const rows = [['已掌握', 'mastered', '#059669'], ['部分掌握', 'partial', '#d97706'], ['尚未掌握', 'notyet', '#e11d48']]
      .filter(x => r[x[1]]);
    h.innerHTML = `<div class="ls ls-exit">
      <div class="ls-view ls-v-q show">
        <div class="ls-tag">出口題（獨立完成，約 2～3 分鐘）</div>
        <div class="ls-q">${o.q}</div>
        ${o.ans ? `<div class="ls-ans">答：${o.ans}</div>` : ''}
      </div>
      <div class="ls-view ls-v-r">
        ${rows.map(x => `<div class="ls-rub" style="--rc:${x[2]}"><b>${x[0]}</b>${r[x[1]]}</div>`).join('')}
      </div>
      <div class="ls-actions ls-ui">
        ${o.ans ? '<button class="ls-btn ls-ui" data-act="ans">參考答案</button>' : ''}
        ${rows.length ? '<button class="ls-btn ls-ui" data-act="rub">判準與後續</button>' : ''}
      </div>
    </div>`;
    const ab = h.querySelector('[data-act="ans"]'), ans = h.querySelector('.ls-ans');
    if (ab) ab.onclick = () => { const on = !ans.classList.contains('show'); toggle(ans, on); ab.textContent = on ? '收起答案' : '參考答案'; if (on) typeset(ans); };
    const rb = h.querySelector('[data-act="rub"]');
    if (rb) rb.onclick = () => {
      const on = !h.querySelector('.ls-v-r').classList.contains('show');
      toggle(h.querySelector('.ls-v-r'), on); toggle(h.querySelector('.ls-v-q'), !on);
      rb.textContent = on ? '回到題目' : '判準與後續';
      if (on) typeset(h);
    };
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
    const counts = $$(h, '.ls-count'), bars = $$(h, '.ls-bar i');
    const paint = () => {
      const n = counts.map(b => +b.textContent), max = Math.max(1, ...n);
      bars.forEach((b, i) => { b.style.width = (n[i] / max * 100) + '%'; });
    };
    counts.forEach(b => { b.onclick = () => { b.textContent = String(+b.textContent + 1); paint(); }; });
    const zb = h.querySelector('[data-act="reset"]');
    if (zb) zb.onclick = () => { counts.forEach(b => { b.textContent = '0'; }); paint(); };
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

  window.LS = { goals, tasks, check, mistake, timer, exit, tally, tiers, anim, TIER };
})();
