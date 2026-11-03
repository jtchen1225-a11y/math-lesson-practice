# math-lesson-practice：40 分鐘數學練習課

方法已學過的 40 分鐘練習課：診斷決定起點 → 回顧關鍵步驟 → 兩輪分層練習（第二輪換條件，不是加題量）→ 錯誤門診 → 出口題。

給 AI Agent（Claude Code 等）安裝使用的技能。Agent 依教師提供的年級、課題與目標，產出兩份成品：

1. **教案 `lesson-plan.md`**：課堂基本資料、40 分鐘流程表、A／B／C 分層練習、典型錯誤分析、出口題與三類學生後續安排、課後反思框架、品質檢查表。
2. **互動課堂簡報 `site\index.html`**：可離線、雙擊開啟、投影字級 28pt。內建分層任務與提示階梯、全班理解檢查（計票＋迷思說明）、錯誤分析、計時器、出口題、自評統計，還有雷射筆、畫筆和放大成整頁。

## 本課型的五個階段

| 時間 | 階段 | 頁面 |
|------|------|------|
| 0–5 分鐘 | 診斷起步題 | 1-1 本節練習目標、1-2 診斷題 |
| 5–10 分鐘 | 方法回顧與關鍵步驟 | 2-1 關鍵步驟、2-2 檢查方法 |
| 10–25 分鐘 | 分層練習兩輪＋巡視 | 3-1 第一輪：基本題型、3-2 巡視計時、3-3 第二輪：條件變化 |
| 25–35 分鐘 | 錯誤門診＋再試一題 | 4-1 錯誤門診、4-2 再試一題 |
| 35–40 分鐘 | 出口題＋自我評估 | 5-1 出口題、5-2 自我評估 |

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

> 請用 math-lesson-practice 幫我設計一節七年級「一元一次方程式去括號」的練習課。

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
