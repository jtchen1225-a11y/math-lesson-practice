/* ============ 第 2 階段　5–10 分鐘　解題秘笈大公開（教案：方法回顧與關鍵步驟） ============
   課型：練習課（範例：中一 一元一次方程 拆括號與移項）
   本階段小節：2-1 解題秘笈、2-2 自我檢查
   只回顧已學過的方法，不做新的完整講授。
   ============================================================ */
window.DECK = window.DECK || [];
(function () {
  const C = "#7c3aed";
  const GRN = '#059669', RED = '#e11d48';

  const TX = (x, y, s, o = {}) =>
    `<text x="${x}" y="${y}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} font-size="${o.fs || 30}" font-weight="${o.fw || 800}" fill="${o.c || '#172033'}">${s}</text>`;

  window.DECK.push({
    ch: 2,
    time: "5–10 分鐘",
    title: "解題秘笈大公開",
    color: C,
    sections: ["2-1 解題秘笈", "2-2 自我檢查"],
    slides: [
      {
        sec: '2-1', secName: '解題秘笈',
        title: '解題四步驟，每步說理由',
        points: ['拆括號 → 移項 → 合併 → 檢驗。'],
        formula: { label: '例', tex: '2(x+3)=x+10' },
        visual: (h) => {
          SV.stepper(h, '0 0 440 250', [
            { t: '拆括號：2 要乘括號內每一項', d: k => TX(220, 44, '2x + 6 = x + 10', { anchor: 'middle' }) },
            { t: '移項：移過等號要變號', d: k => TX(220, 102, '2x − x = 10 − 6', { anchor: 'middle', c: C }) },
            { t: '合併同類項', d: k => TX(220, 160, 'x = 4', { anchor: 'middle', c: RED, fs: 32 }) },
            { t: '代入原式：左右都是 14', d: k => TX(220, 218, '2(4+3) = 14 = 4 + 10', { anchor: 'middle', c: GRN }) }
          ]);
        }
      },
      {
        sec: '2-2', secName: '自我檢查',
        title: '解出答案後，怎樣確認對不對？',
        points: ['想一想再選，等一下要說理由。'],
        visual: (h) => LS.check(h, {
          q: '解出 \\(x=4\\) 後，最可靠的檢查方法是？',
          options: [
            { t: '代入原式，看左右是否相等', ok: true, why: '直接驗證等式成立' },
            { t: '看答案是不是整數', why: '解也可能是分數或負數' },
            { t: '照原步驟再算一次', why: '可能重複同一個錯誤' }
          ]
        })
      }
    ]
  });
})();
