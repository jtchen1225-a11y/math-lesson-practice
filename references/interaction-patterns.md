# 互動寫法：常見模式

> **[本機版]** 本檔改自原版。投影模式下滑桿標籤與數值為 28pt，label 要更短；最多兩個滑桿。驗證腳本限制見文末與 SKILL.md 第 5 節。

互動是這個框架的價值所在。**每章至少 3~5 頁要有互動**，而且互動要能**回答一個問題**，
不是「拖著玩」。

## 基本骨架：單一滑桿

```js
visual: (h) => {
  h.innerHTML = `<div style="width:100%"><div id="fig"></div>
    <div class="ictrl"><label>倍率 k ＝ <span class="ival" id="kv">1.5</span></label>
    <input type="range" id="ks" min="0.5" max="2" step="0.1" value="1.5"></div></div>`;
  const draw = () => {
    const k = +h.querySelector('#ks').value;
    h.querySelector('#kv').textContent = k.toFixed(1);
    h.querySelector('#fig').innerHTML = svg('0 0 440 290', /* …依 k 產生 SVG… */);
  };
  h.querySelector('#ks').oninput = draw;
  draw();                       // ← 一定要先畫一次
}
```

規則：

- 控制列 class 必須是 `ictrl`，數值 span class 必須是 `ival`（樣式與版面計算靠它們）
- **只能用 `h.querySelector`**，不可用 `document.getElementById`
- 最後一定要呼叫一次 `draw()`，否則初次進頁是空的
- **最多兩個滑桿**，label 文字要短（太長會換行、把圖擠掉）

## 雙滑桿

```js
h.innerHTML = `<div style="width:100%"><div id="fig"></div>
  <div class="ictrl"><label>a ＝ <span class="ival" id="av">3</span></label>
  <input type="range" id="as" min="-8" max="8" step="1" value="3">
  <label>b ＝ <span class="ival" id="bv">-5</span></label>
  <input type="range" id="bs" min="-8" max="8" step="1" value="-5"></div></div>`;
// …
h.querySelector('#as').oninput = draw;
h.querySelector('#bs').oninput = draw;
draw();
```

---

## 模式清單（實測有效）

### 1. 參數 → 圖形（最通用）

拖係數看圖形怎麼變。適合：二次函數的 `a/h/k`、正比反比、相似比、指數成長。

**關鍵**：放一條**灰色參考線**（例如 `y=x²`），讓學生看得出「相對於基準變了多少」。

### 2. 逐步推理（`SV.stepper`）

適合：證明、尺規作圖、長除法、配方法、消去法、篩法。

**關鍵**：每一步只做一件事，`t` 寫清楚「這一步在幹嘛」。
最容易失分的那一步要用顏色標出來（例如去括號時第二項也要變號）。

### 3. 極端值演示

固定一組資料，拖動其中**一筆**到極端，看統計量怎麼反應。

**關鍵**：同時畫出兩個對照量（例如平均數 vs 中位數、全距 vs 四分位距），
一個會被拉走、一個不動——這比講十句話有用。

### 4. 面積／方格模型

用色塊面積表示乘法、分數、乘法公式 `(a+b)²`。

**關鍵**：重疊區用深色，並在圖下即時顯示「總格數＝分母、重疊格數＝分子」。

### 5. 枚舉盤

把所有可能情形排成格子（例如兩顆骰子的 6×6），拖滑桿切換條件，
符合的格子染色並即時算出個數與機率。

**關鍵**：分母固定不動、只有分子隨條件變，讓學生看清「全部結果數」是什麼。

### 6. 狀態切換盤

滑桿當成「第 N 種情形」的切換器（不是連續量）。
適合：六種四邊形的對稱軸、三種線與面的關係、三視圖的三個方向。

```js
<input type="range" id="ss" min="0" max="5" step="1" value="0">
```

**關鍵**：`ival` 顯示的是**名稱**不是數字（例如「菱形」而非「2」）。

### 7. 驗算器

給一個錯誤答案與正確答案，讓學生**代入數字親眼看到錯的那個會失敗**。

適合：不等式除以負數要換向、絕對值、無解的判斷。
**關鍵**：即時顯示「成立 ✓／不成立 ✗」。

### 8. 攤平／展開

從立體圖漸變到展開圖（滑桿當作攤平進度）。適合：柱體、錐體的表面積。

---

## 版面注意

- 有 `.ictrl` 的頁，SVG `viewBox` 高度建議 **≤300**（要留位置給控制列）
- 寬高比不要低於 **1.35**
- 引擎會把「圖＋滑桿」當成一整組等比縮放，所以不用自己算縮放
- 滑桿的 `min/max/step` 要讓每一個值都是**有意義**的；
  例如 `a` 不可以是 0 的話，就在 `draw()` 裡跳過 0：

```js
let a = +h.querySelector('#as').value;
if (a === 0) a = 0.5;          // a≠0
```

## 驗證

`node scripts/verify_deck.js <資料夾>` 會**掃過每個滑桿的每一個值**並實際執行 `draw()`，
能抓出「只有拖到某個值才會**拋出錯誤**」的情況（例如讀取未定義的屬性、陣列長度為負）。
**[本機註記] 它抓不到**：除以零產生的 Infinity／NaN（不會拋錯，圖默默消失）、超過 80 格滑桿的最大值端、`addEventListener` 綁定的滑桿、真實 SV 與替身的差異、數學錯誤。請在 `draw()` 內自行處理分母為 0 與退化圖形，並在瀏覽器把滑桿拖到兩端人工確認。
每次改完互動頁都要跑。

**[本機新增] 瀏覽器互動驗證**：改用 `python scripts/validate_deck.py <site>`（SKILL.md 第 4 節）。它用實際引擎與真正的 SV，在真實 DOM 觸發 input／change 事件（含 `addEventListener`），測每個滑桿的最小值、最大值與全部合法步進值，並檢查 NaN／Infinity、繪圖資料缺少、公式排版錯誤；仍抓不到數學錯誤與退化圖形，滑桿兩端與特殊值的圖形仍要人工看。公式會隨滑桿變的頁，建議寫 `selfCheck`（slide-spec.md）。
