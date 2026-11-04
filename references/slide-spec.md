# chN.js 撰寫規格（課堂版）

> **[課堂版]** 一個 `chN.js` ＝ 一節課的**一個階段**（例：ch2.js＝5–15 分鐘核心講解）。章物件多一個 `time` 欄位（例：`'5–15 分鐘'`），顯示在階段頁與頂部列。章名頁就是「階段轉換頁」。下文提到「章」時，請讀成「階段」。課堂元件（分層任務、理解檢查、錯誤分析、計時、出口題、自評）見 `lesson-components.md`。

> **[本機版]** 本檔改自原版（upstream-1986261/references/slide-spec.md）。投影模式下主要文字 28pt，內容量要比原版少；HTML 內嵌字級用 `var(--mrd-body)`；SVG 文字以 `?check` 實測 ≥28pt。不預設任何課綱或出版社。

> 這是沿用 math-review-deck 框架的投影片格式規格。
> 動手寫任何一章之前先讀完；`SV` 工具的完整 API 見 `svg-toolkit.md`。

## 0. 一句話說明
每個 `chN.js` 定義**一章**，push 進 `window.DECK`。引擎會自動：
每章先出一張「章名頁」，再依 `slides` 陣列逐頁渲染成**左右兩欄**（左＝概念欄、右＝視覺欄）。

## 1. 檔案骨架（照抄，只改 ch/title/color/sections）

```js
/* ============ 第 N 章　章名 ============
   節次：N-1 節名、N-2 節名 …（課綱／課程計畫依使用者提供的文件填寫）
   ============================================================ */
window.DECK = window.DECK || [];
(function () {
  const C = '#2563eb';                 // 本章主色（見 §2）
  const RED = '#e11d48', GRN = '#059669', BLU = '#2563eb', VIO = '#7c3aed', AMB = '#d97706';

  // 標準 SVG 包裝：一定要用這個，讓圖能自適應欄寬
  function svg(vb, inner) { return `<div style="width:100%;text-align:center"><svg viewBox="${vb}" style="max-width:100%">${inner}</svg></div>`; }

  window.DECK.push({
    ch: N,
    time: '5–15 分鐘',              // [課堂版] 本階段時間
    title: '階段名稱',
    color: C,
    sections: ['N-1 節名', 'N-2 節名'],
    slides: [
      /* ---------- N-1 節名 ---------- */
      { …投影片物件… },
      { …投影片物件… },
    ]
  });
})();
```

**注意**：整個檔案包在 IIFE 內，章與章之間變數不會互相污染。載入順序由 index.html 決定（ch1→ch2→…）。

## 2. 章色（依章序取用，不可重複）
| 章序 | 色碼 | 名稱 |
|---|---|---|
| 1 | `#2563eb` | 藍 |
| 2 | `#7c3aed` | 紫 |
| 3 | `#059669` | 綠 |
| 4 | `#d97706` | 琥珀 |
| 5 | `#e11d48` | 玫紅 |
| 6 | `#0891b2` | 青 |

## 3. 投影片物件完整欄位

```js
{
  sec: '1-2',                    // 必填，節次編號（顯示在徽章與目錄）
  secName: '比例線段',            // 必填，節名（顯示在徽章）
  title: '平行線截比例線段',       // 必填，這一頁的「一個重點」，是頁面大標
  points: [                      // 必填，投影版 2~3 條（28pt 下 4 條幾乎必超出）
    '第一條重點，可用 <b>粗體</b>、<span class="k">關鍵詞</span>、行內數學 \\(a:b=c:d\\)。',
    '第二條…'
  ],
  formula: { label: '公式標籤', tex: 'a:b=c:d\\;\\Longleftrightarrow\\;ad=bc' },   // 選填，會以 $$…$$ 置中排版
  visual: (h) => { … },          // 必填，見 §5
  caption: '圖下方一行說明，可含 <b> 與 \\(數學\\)。',    // 選填但強烈建議
  example: {                     // 選填但強烈建議（每頁都該有）
    q: '題目，可含數學 \\(3:5=x:20\\)。',
    steps: ['第一步…', '第二步…'],       // 2~4 步
    ans: '\\(x=12\\)'
  },
  selfCheck: (h) => { … }        // [本機新增] 選填：只在 validate_deck.py 驗證時執行，見下方
}
```

### selfCheck（本機新增，選填）

驗證工具在每個滑桿值繪製完成後呼叫 `selfCheck(h)`（`h` 為 `.visual-host`）。回傳 `null`／空陣列表示通過，回傳字串或字串陣列表示問題。一般播放時不會執行。適合檢查「公式與圖是否同步」這類通用檢查抓不到的條件。例：

```js
selfCheck: (h) => {
  const k = h.querySelector('#ks').value;
  const items = MathJax.startup.document.getMathItemsWithin([h.querySelector('.fx')]);
  if (items.length !== 1) return `公式數量 ${items.length}（應為 1）`;
  const tex = items[0].math.replace(/\s/g, '');          // 讀回 MathJax 實際排版的 TeX
  return tex === `y=${k}x` ? null : `顯示的公式「${tex}」與滑桿 k=${k} 不一致`;
}
```
selfCheck 是作者自己寫的條件，只能證明「它寫到的條件」成立，不代表數學內容全部正確。

### 文字撰寫規則
- **一頁只講一個重點**，`title` 就是那個重點，用完整句子（例：「外角 = 兩個內對角的和」）。
- `points` 投影版每條約 ≤24 字（28pt 下概念欄一行約 16～18 字），講「怎麼看／怎麼用」，不是照抄課本定義。原版 45 字是螢幕閱讀尺寸。
- 關鍵術語第一次出現用 `<span class="k">術語</span>`（會有底色標記），強調用 `<b>`。
- 全部繁體中文。

### 數學排版（MathJax 3）
- 行內：`\\( … \\)`（JS 字串內雙反斜線）。
- 區塊：只出現在 `formula.tex`，引擎會自動包 `$$…$$`，**tex 內不要再寫 `$$`**。
- 線段一律寫 `\\overline{AB}`，不要寫 `AB`。
- 角度寫 `90^\\circ`；平行 `\\parallel`；相似 `\\sim`；全等 `\\cong`；三角形 `\\triangle ABC`。
- 中文夾在公式裡要用 `\\text{中文}`。

## 4. 可用的共用工具 `SV`（定義於 svg.js，全域可用）

| 函式 | 用途 |
|---|---|
| `SV.seg(x1,y1,x2,y2,color,w,dash)` | 線段 |
| `SV.poly([[x,y],…], fill, stroke, w)` | 多邊形 |
| `SV.dot(x,y,color,r)` | 端點圓點 |
| `SV.vlabel(x,y,text,color,fs)` | 頂點／文字標籤 |
| `SV.angle(cx,cy,r,d0,d1,color,label,opt)` | 角弧＋角度文字（**數學角度**，逆時針為正） |
| `SV.rightAngle(cx,cy,d0,d1,size,color)` | 直角小方框 |
| `SV.ticks(x1,y1,x2,y2,n,color,len)` | 邊上等長刻度記號 |
| `SV.arrowDefs(color,id)` | 箭頭 marker 定義 |
| `SV.plane({x0,y0,w,h,xmin,xmax,ymin,ymax,step})` | 坐標平面，回傳 `{svg, X, Y, defs}`；`X(mx)`、`Y(my)` 把數學座標轉螢幕座標 |
| `SV.fbox(rows, opt)` | 公式卡片列（HTML）；`rows=[{label,tex,note,color,fill,border,size,w}]` |
| `SV.stepper(h, vb, steps, opt)` | **步驟滑桿**；`steps=[{t:'說明HTML', d:(k)=>'SVG片段'}]`，`k` 為該步驟內 0~1 連續進度；`opt.acc=false` 表示每步自己畫完整場景（預設 true＝疊加） |
| `window.MJ(el)` | 互動更新後重新排版該區塊的 MathJax |

**SVG 座標提醒**：`SV.plane` 與一般繪圖用**螢幕座標**（y 向下）；只有 `SV.angle` / `SV.pt` 的角度參數用數學角度（逆時針為正、0°＝正右）。

## 5. `visual(h)` 的三種寫法

`h` 是 `.visual-host` 元素。目標：**一張圖說清楚這一頁的重點**，不要塞太多字。

### (a) 靜態圖
```js
visual: (h) => {
  h.innerHTML = svg('0 0 440 300', `
    ${SV.poly([[60,250],[380,250],[220,60]], 'rgba(37,99,235,.06)', C)}
    ${SV.angle(60,250, 34, 0, 27, RED, '∠B')}
    ${SV.vlabel(50,268,'B')}
  `);
}
```

### (b) 公式卡（沒有幾何圖時用這個，不要留空）
```js
visual: (h) => {
  h.innerHTML = SV.fbox([
    { label: '定義', tex: 'a^m\\times a^n=a^{m+n}', color: C, fill: '#eef4ff', border: C, size: 20 },
    { label: '例', tex: '2^3\\times2^4=2^7=128', color: GRN, border: '#cfe8dd', size: 18, note: '底數相同才能相加指數' }
  ]);
}
```

### (c) 互動滑桿（**每章至少 3~5 頁要有**）
```js
visual: (h) => {
  h.innerHTML = `<div style="width:100%"><div id="fig"></div>
    <div class="ictrl"><label>倍率 k <span class="ival" id="kv">1.5</span></label>
    <input type="range" id="ks" min="0.5" max="2" step="0.1" value="1.5"></div></div>`;
  const draw = () => {
    const k = +h.querySelector('#ks').value;
    h.querySelector('#kv').textContent = k.toFixed(1);
    h.querySelector('#fig').innerHTML = svg('0 0 440 300', /* …依 k 產生 SVG… */);
  };
  h.querySelector('#ks').oninput = draw; draw();
}
```
- 控制列 class 一定要是 `ictrl`，數值 span 用 class `ival`。
- id 只在該 host 內查找（`h.querySelector`），**不要用 `document.getElementById`**，避免跨頁衝突。
- 若圖需要 MathJax，更新後呼叫 `MJ(h)`。

### (d) 步驟滑桿（推理／作圖／證明頁用）
```js
visual: (h) => {
  SV.stepper(h, '0 0 440 300', [
    { t: '先畫出 △ABC 與已知條件', d: k => SV.poly(...) },
    { t: '作 <b>AD</b> 平分 ∠A', d: k => SV.seg(...) },
    { t: '由 SAS 得兩三角形全等', d: k => SV.vlabel(...) }
  ]);
}
```

## 6. 版面限制（**很重要**，引擎會自動縮放但別逼它縮太小）
- 視覺欄 SVG 建議 `viewBox` 寬 400~460、高 260~330。**寬高比不要超過 1.6**。
- 有 `.ictrl` 的頁，SVG 高度會被限成 `calc(100% - 72px)`，圖請留白多一點。
- 左欄（badge＋title＋formula＋points＋example）內容總量：
  **title 1 行 + formula 1 行 + points 3 條 + example 題目 2 行**是舒服的量。
- 不要在 `points` 裡放 `<br>` 堆疊、不要放表格。

## 7. 每階段份量（課堂版）
- 一節 40 分鐘課，整份簡報**至少 25 頁（含階段頁）**，最後一頁是本節核心知識小結（`LS.summary`）。
- 每一頁對應一個學生活動，左欄寫「學生現在要做什麼」，右欄放圖解、互動或課堂元件。
- 講解頁不超過 3 頁連續講授；每個講解段落後接一個理解檢查（`LS.check`）。

## 8. 內容邊界（絕對不可超出）
把「本冊刻意不教什麼」寫在每個 `chN.js` 的檔頭註解，並逐條遵守。
若有課綱／課程計畫文件，以原文的「備註」欄為準——「不處理」「不涉及」「以…為限」是硬性紅線。
可用 `node scripts/verify_deck.js <資料夾> --forbid "詞1,詞2"` 讓超綱字詞直接變成錯誤。

## 8.5 改完一定要做的事

改了任何 `chN.js`，**務必同步更新 `index.html` 裡的 `?v=` 版本號**（六個資源共用同一個字串）。
沒更新的話，瀏覽器會拿快取的舊章節，你會誤以為改動沒生效——這個坑踩過很多次。

## 9. 自我檢查（交件前）
1. `node scripts/verify_deck.js <資料夾>` 要全綠（它已包含 `node --check`；**有已知限制**，見 SKILL.md 第 5 節）。另用瀏覽器開 `index.html?check`，在投影解析度下不可有 ✗。
2. 每張投影片都有 `sec / secName / title / points / visual`。
3. 所有 `\\(` 都有對應的 `\\)`；`\\overline{}`、`\\frac{}{}` 大括號成對。
4. `visual` 內沒有 `document.getElementById`。
5. 沒有用到其他章的變數。
6. 核心講解階段至少 1 頁有 `.ictrl` 或 `SV.stepper` 互動；整份課至少 2 個理解檢查點（`LS.check`、`LS.tasks` 巡視或 `LS.exit`）。
