# `SV` 幾何工具庫 API

> **[本機版]** 本檔改自原版。`SV.fbox` 字級已改為「原設定與 28pt 取大者」。SVG 文字（`vlabel`、`angle` 標籤、自寫 `<text>`）的實際大小＝font-size×縮放比例，投影前必須用 `index.html?check` 實測。`SV.plane` 刻度數字固定 11 單位、淺灰色，投影時通常太小，需要讓學生讀刻度時請自行加大標示。

`svg.js` 提供全域物件 `SV`，所有函式都**回傳 SVG 字串片段**，用字串串接組出整張圖。

## 座標系統（最容易搞錯的地方）

- 一般繪圖、`SV.plane`：用**螢幕座標**，原點在左上角，**y 往下為正**。
- `SV.angle`、`SV.pt`、`SV.rightAngle` 的角度參數：用**數學角度**，
  逆時針為正、0° 指向正右方。函式內部會自動翻轉成螢幕座標。

## 標準包裝

每個 `chN.js` 都應該自備這個小工具，讓圖自適應欄寬：

```js
function svg(vb, inner) {
  return `<div style="width:100%;text-align:center"><svg viewBox="${vb}" style="max-width:100%">${inner}</svg></div>`;
}
```

---

## 基本圖元

| 函式 | 說明 |
|---|---|
| `SV.seg(x1, y1, x2, y2, color, w, dash)` | 線段。`dash` 例如 `'5 4'` 畫虛線 |
| `SV.poly(points, fill, stroke, w)` | 多邊形。`points` 為 `[[x,y], …]` |
| `SV.dot(x, y, color, r)` | 端點圓點，`r` 預設 4.5 |
| `SV.vlabel(x, y, text, color, fs)` | 頂點／文字標籤 |
| `SV.arrowDefs(color, id)` | 箭頭 marker 定義，放在 svg 開頭一次，之後用 `marker-end="url(#id)"` |

## 幾何標記

| 函式 | 說明 |
|---|---|
| `SV.angle(cx, cy, r, d0, d1, color, label, opt)` | 角弧＋角度文字。從 `d0` 逆時針畫到 `d1`（數學角度）。`opt.fill=true` 填色、`opt.lr` 調文字距離、`opt.fs` 字級 |
| `SV.rightAngle(cx, cy, d0, d1, size, color)` | 直角小方框，畫在頂點 `(cx,cy)` 介於兩方向之間 |
| `SV.ticks(x1, y1, x2, y2, n, color, len)` | 邊上的等長刻度記號，`n` 條，用來標「相等的邊」 |

```js
// 例：在 B 點畫一個從 0° 到 27° 的角，標上 ∠B
SV.angle(60, 250, 34, 0, 27, RED, '∠B')
// 例：標記 AB 與 CD 等長（各畫一條刻度）
SV.ticks(ax, ay, bx, by, 1, RED) + SV.ticks(cx, cy, dx, dy, 1, RED)
```

## 坐標平面

```js
const P = SV.plane({ x0: 60, y0: 40, w: 420, h: 360,
                     xmin: -6, xmax: 6, ymin: -6, ymax: 6, step: 1 });
// P.svg  → 格線與軸的 SVG 片段
// P.defs → 箭頭定義（記得也要輸出）
// P.X(mx), P.Y(my) → 把數學座標換成螢幕座標
let s = P.defs + P.svg;
s += SV.dot(P.X(2), P.Y(3), '#e11d48');       // 在 (2,3) 畫點
```

> 版面提醒：`SV.plane` 預設尺寸偏大。視覺欄比較窄時，建議自己縮小
> （例如 `w:352, h:208`），或改用自繪的小格線。

## 公式卡 `SV.fbox`

沒有幾何圖可畫時用這個，**不要讓視覺欄留白或只放一行字**。

```js
h.innerHTML = SV.fbox([
  { label: '定義', tex: 'a^m\\times a^n=a^{m+n}',
    color: C, fill: '#eef4ff', border: C, size: 20 },
  { label: '例',  tex: '2^3\\times2^4=2^7=128',
    color: GRN, border: '#cfe8dd', size: 18, note: '底數相同才能相加指數' }
], { gap: 12 });
```

每列可用欄位：`label`（小標）、`tex`（MathJax 內容，**不要寫 `$$`**）、
`note`（下方灰字）、`color`、`fill`、`border`、`size`、`w`、`pad`。

## 步驟講解器 `SV.stepper`

推理、作圖、證明、多步驟計算最適合用它——拖滑桿逐步展開。

```js
SV.stepper(h, '0 0 440 300', [
  { t: '先畫出 △ABC 與已知條件', d: k => SV.poly([A, B, C], 'rgba(37,99,235,.06)', C) },
  { t: '作 <b>AD</b> 平分 ∠A',    d: k => SV.seg(A[0], A[1], D[0], D[1], RED, 3) },
  { t: '由 SAS 得兩三角形全等',   d: k => SV.vlabel(220, 280, '△ABD ≅ △ACD') }
], { acc: true });
```

- `t`：該步驟的說明（可含 HTML）
- `d(k)`：回傳該步驟的 SVG 片段。`k` 是**該步驟內 0~1 的連續進度**，
  可以用來做「拖到一半時動到一半」的連續動畫
- `opt.acc`（預設 `true`）：疊加前面所有步驟。設 `false` 表示每步自己畫完整場景

## MathJax 重排

互動更新後如果圖裡含 MathJax 內容，呼叫：

```js
MJ(h);   // 重新排版 h 這一塊
```

---

## 常用色票

```js
const RED = '#e11d48', GRN = '#059669', BLU = '#2563eb',
      VIO = '#7c3aed', AMB = '#d97706';
```

章色（依章序，不要重複）：

| 章 | 色碼 |
|---|---|
| 1 | `#2563eb` 藍 |
| 2 | `#7c3aed` 紫 |
| 3 | `#059669` 綠 |
| 4 | `#d97706` 琥珀 |
| 5 | `#e11d48` 玫紅 |
| 6 | `#0891b2` 青 |

## 字型缺字警告

微軟正黑體**沒有** ⁴~⁹ 上標、`∼`、`≈`、`⅔`，會渲染成方框。
可安全使用：`²` `³` `°` `∠` `△` `≦` `√` `×` `≥` `≤`。
指數請寫成 MathJax（`\\(10^{7}\\)`），或改用文字「10 的 7 次方」。
