# math-lesson-practice：40 分鐘數學練習課

方法已學過的 40 分鐘練習課：診斷決定起點 → 回顧關鍵步驟 → 兩關分層練習（第二關換條件，不是加題量）→ 錯誤門診與綜合解難 → 出口題。

**螺旋式設計：能力提升螺旋：基礎辨識 → 獨立應用 → 變式比較 → 綜合解難。** 每份教案都包含先備知識地圖、螺旋深化路徑、分層學習任務、間隔重現計劃和學習證據追蹤。

給 AI Agent（Claude Code 等）安裝使用的技能。Agent 依教師提供的年級、課題與目標，產出三份成品：

1. **教案 `lesson-plan.md`**：課堂基本資料、40 分鐘流程表、A／B／C 分層練習、巡視觀察表、不同學生的支援、典型錯誤分析、出口題與三類學生後續安排、課後反思框架、品質檢查表。
2. **互動課堂簡報 `site\index.html`**：可離線、雙擊開啟、投影字級 28pt。內建三層同頁任務（A 基礎支持、B 核心達標、C 延伸挑戰同時顯示，各有提示與答案；專注時間的倒數和題目在同一頁）、全班理解檢查（計票＋迷思說明）、錯誤分析、出口題、自評統計、可下載 CSV 的課堂紀錄（只有人數），倒數時間到會響鈴，還有雷射筆、畫筆和放大成整頁。投影畫面上的階段與頁面名稱都寫成給學生看的任務名稱，教師用的名稱和出口題判準只放在教案。範例與預設用語為香港用語。


3. **可列印紙本 `site\handout.html`**：學生學習單（沒有答案）、出口小紙條、延遲檢測小紙條（各一張 A4 六份）、教師版（巡視觀察表、判準、答案）。題目直接讀簡報內容，不用寫兩次。

課後把出口題人數、課堂紀錄 CSV 和約一週後的延遲檢測結果交給 Agent，它會用 `scripts/summarize_evidence.py` 整理證據，分辨學生是短暫學會還是真正掌握，再寫出下一節的調整。

## 本課型的課堂階段

| 時間 | 簡報上的名稱（給學生看） | 教案名稱（給教師看） | 螺旋位置 | 頁面 |
|------|------|------|------|------|
| 0–6 分鐘 | 暖身診斷：你在哪一關？ | 診斷起步題 | 基礎辨識 | 1-1 今天的目標、1-2 診斷快問、1-3 診斷二：負號、1-4 診斷三：這是解嗎？ |
| 6–11 分鐘 | 解題秘笈大公開 | 方法回顧與關鍵步驟 | 基礎辨識（方法與檢查） | 2-1 解題秘笈、2-2 自我檢查、2-3 秘笈二：負號、2-4 代入檢驗 |
| 11–25 分鐘 | 兩輪闖關：基本功到變化題 | 分層練習兩輪＋巡視 | 獨立應用 → 變式比較 | 3-1 第一關：基本功、3-2 比一比：括號、3-3 第二關：比一比、3-4 比一比：做法 |
| 25–35 分鐘 | 抓錯偵探＋綜合解難 | 錯誤門診＋綜合解難 | 綜合解難 | 4-1 抓錯偵探、4-2 再抓一次、4-3 綜合解難、4-4 生活解難、4-5 輪到你出題 |
| 35–40 分鐘 | 最後一關＋幫自己打分 | 出口題＋自我評估 | 學習證據 | 5-1 出口挑戰、5-2 我的程度、5-3 核心知識小結 |

## 安裝

技能就是這整個資料夾，`SKILL.md` 在最上層。

**Claude Code（Windows PowerShell）**

```powershell
git clone https://github.com/jtchen1225-a11y/math-lesson-practice.git "$env:USERPROFILE\.claude\skills\math-lesson-practice"
```

**Claude Code（macOS／Linux）**

```bash
git clone https://github.com/jtchen1225-a11y/math-lesson-practice.git ~/.claude/skills/math-lesson-practice
```

**其他 Agent**：把這個 Repo 複製到該 Agent 讀取技能的資料夾。也可以直接把 Repo 網址交給 Agent，請它安裝。

安裝後重新開啟 Agent，然後這樣說：

> 請用 math-lesson-practice 幫我設計一節中一「一元一次方程拆括號」的練習課。

## 需要的環境

- Python 3、Node.js（只用內建模組），以及已安裝的 Edge 或 Chrome（驗證時才需要）。
- 不需要網路、不需要 API 金鑰、不需要安裝任何套件。MathJax 3.2.2 已附在 `vendor/mathjax/`，Repo 約 10 MB。

## 三個課型技能

| 技能 | 用途 |
|------|------|
| [math-lesson-new](https://github.com/jtchen1225-a11y/math-lesson-new) | 新課講授：新概念第一次教 |
| [math-lesson-practice](https://github.com/jtchen1225-a11y/math-lesson-practice) | 練習課：已學方法練到正確、穩定、能變通 |
| [math-lesson-review](https://github.com/jtchen1225-a11y/math-lesson-review) | 複習課：單元內容的診斷、統整、綜合應用與易錯辨析 |

三個技能共用同一套簡報引擎與課堂元件，可以分開安裝。

## 範例

`examples/linear-equation/` 收錄一份完整範例：`lesson.json`、`ch1.js`～`ch5.js`、`lesson-plan.md`，已通過格式、互動、公式和版面驗證，數學內容也用 Python 驗算過。範例教案沒有真實課堂資料，學生表現都標註為「預期情況」。

## 授權與來源

- 簡報框架改自 [mathruffian-dot/math-review-deck](https://github.com/mathruffian-dot/math-review-deck)（MIT），見 `LICENSE`。
- MathJax 3.2.2：Apache-2.0，見 `vendor/mathjax/LICENSE`。
- 課堂設計原則見 `references/lesson-principles.md`。
- 修改內容與測試紀錄見 `CHANGES.md`。
