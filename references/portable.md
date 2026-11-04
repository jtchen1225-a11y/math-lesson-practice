# 開啟與攜帶（課堂版）

> 本技能**不提供部署流程**。要放上網站時，由使用者另行指示，例如改用部署類技能。

## 產出結構（多檔資料夾，不是單檔 HTML）

```
<名稱>\
├── lesson.json            # 設定檔
├── lesson-plan.md         # 教案（A～F＋品質檢查）
├── validation-report.md   # 驗證報告（validate_deck.py 產生）
└── site\
    ├── index.html         # 封面、目錄、舞台、教具列；MathJax 設定（相對路徑、選單關閉）
    ├── handout.html、handout.js、handout.css  # 可列印的學習單、出口小紙條、教師版
    ├── engine.js          # 導覽與渲染（以「階段」為單位、超出提示、?check 檢查模式）
    ├── style.css          # 樣式（系統字型，無 Google Fonts）
    ├── projection.css     # 投影字級 28pt、不自動縮小
    ├── svg.js             # SV 繪圖工具
    ├── lesson.js、lesson.css  # 課堂元件（分層任務、理解檢查、錯誤分析、計時、出口題、自評）
    ├── ch1.js … ch5.js    # 各階段內容（一個階段一個檔）
    └── mathjax\           # MathJax 3.2.2（約 10 MB，Apache-2.0）
```

## 開啟

| 方式 | 做法 |
|------|------|
| 雙擊 `site\index.html`（file://） | 直接用 Edge／Chrome 開，不需要網路 |
| 本機 HTTP | `python -m http.server 8890 --bind 127.0.0.1 --directory "<名稱>\site"`，開 `http://127.0.0.1:8890/` |
| 深連結 | `index.html#present` 直接進簡報；`#p=N` 跳到第 N 個項目（從 0 起算，階段頁也算） |

教室實際投影機、真正斷網（拔網路線）的效果，每次都要由老師實際確認；本技能只做過無頭瀏覽器與 DNS 封鎖模擬。

## 攜帶到另一台電腦

1. 把整個 `site\` 資料夾壓成 zip（含 `mathjax\`）。
2. 在另一台電腦解壓縮後雙擊 `index.html`。
3. 另一台電腦不需要 Python、Node；只有**要再產生骨架或跑驗證**時才需要（見 SKILL.md 第 0 節）。

只複製 `index.html`、或漏掉 `mathjax\`，公式會顯示成原始 TeX；漏掉 `lesson.js` 則課堂元件頁會顯示「視覺載入失敗」。

## 改版

- 改了 `chN.js` 要同步更新 `index.html` 裡所有 `?v=` 版本號（PowerShell）：
  ```powershell
  $f = "output\<名稱>\site\index.html"; $v = Get-Date -Format yyyyMMddHHmm
  (Get-Content $f -Raw -Encoding utf8) -replace '\?v=[0-9a-z]+', "?v=$v" | Set-Content $f -Encoding utf8 -NoNewline
  ```
- 共用的 `engine.js`、`style.css`、`projection.css`、`svg.js`、`lesson.js`、`lesson.css` 改版後，要逐一複製到各份簡報的資料夾。

## 授權

- 框架：MIT（`LICENSE`，來源 mathruffian-dot/math-review-deck）。
- MathJax：Apache-2.0（`site\mathjax\LICENSE`，攜帶時保留）。
