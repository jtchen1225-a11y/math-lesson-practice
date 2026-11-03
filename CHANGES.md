# 修改紀錄與來源

## 來源

| 項目 | 內容 |
|------|------|
| 簡報框架 | [mathruffian-dot/math-review-deck](https://github.com/mathruffian-dot/math-review-deck) commit `1986261`（MIT，`LICENSE` 保留原著作權聲明） |
| 中間版本 | math-review-deck 本機適配版（2026-10-27）：本地 MathJax、投影字級 28pt、超出提示、`?check` 檢查模式、瀏覽器互動驗證 `validate_deck.py` |
| 課堂設計原則 | `references/lesson-principles.md`（40 分鐘數學課堂設計與教學改善 Agent 規範） |
| MathJax | `mathjax@3.2.2`（Apache-2.0），放在 `vendor/mathjax/`，只含 `tex-svg-full` 需要的檔案 |

math-lesson-new、math-lesson-practice、math-lesson-review 三個技能共用同一套引擎與工具，只有 `SKILL.md`、`assets/phases.json`、`examples/` 不同。

## 相對於 math-review-deck 本機適配版的修改

| 檔案 | 修改 |
|------|------|
| `assets/engine.js` | 單位改為「階段」（`window.MRD_UNIT`）；章物件可帶 `time`，顯示在階段頁、封面卡、頂部列；`?check` 不把課堂元件按鈕（`.ls-ui`）當教學文字量字級 |
| `assets/index.template.html` | 載入 `lesson.css`、`lesson.js`；設定 `MRD_UNIT='階段'`；封面按鈕改「開始上課」 |
| `assets/lesson.js`（新增） | 課堂元件 LS：`goals`、`tasks`（A／B／C＋提示階梯）、`check`（同步作答＋計票＋迷思）、`mistake`（不公開身份的錯誤分析）、`timer`、`exit`（三類判準）、`tally`（自評統計） |
| `assets/lesson.css`（新增） | 課堂元件樣式；教學文字 28pt |
| `assets/phases.json`（新增，各課型不同） | 預設五階段、時間與頁面種類 |
| `scripts/new_lesson.py`（取代 `new_deck.py`） | 讀 `lesson.json`；一個階段一個 `chN.js`；檢查各階段時間首尾相接、總長 40 分鐘；同時產生教案草稿 `lesson-plan.md`；MathJax 依序找環境變數 `MATH_LESSON_MATHJAX`、`vendor/mathjax`、`~/.claude/tools/math-review-runtime` |
| `scripts/verify_deck.js` | 先載入 `lesson.js` 讓 `LS` 可在替身環境執行；`LS` 元件頁計入互動頁；替身環境補 `setInterval` |
| `scripts/validate_deck.py` | 報告標題改為課堂簡報；指令路徑改為技能資料夾；「抓不到的問題」加註課堂元件按鈕需人工點過 |
| `references/slide-spec.md` | 加註「一個 chN.js＝一個階段」、`time` 欄位、每階段份量 |
| `references/portable.md` | 改寫產出結構（含教案、lesson.js） |
| `references/lesson-components.md`（新增） | 課堂元件用法 |
| `references/ch-example.js` | 原版範例章，只當寫法參考（未適配投影） |
| 移除 | 原版 `upstream-*` 比對資料夾、修改備份、部署說明；不提供部署與 Git 操作 |

## 測試紀錄（2026-11-03，Windows 11、Edge 無頭模式、file://）

| 測試 | 結果 |
|------|------|
| 三種課型骨架產生（標題含 `<A&B>`、引號、`</script>`） | 代碼 0；每份 5 階段 11 頁；MathJax 從 `vendor/mathjax` 複製 96 個檔案 |
| 再跑一次未加 `--overwrite` | 代碼 3，未寫入 |
| 三份骨架 `validate_deck.py` | 格式、互動／繪圖、公式、版面（1890×938）皆通過 |
| 三份範例（畢氏定理、一元一次方程式、線型函數） `validate_deck.py` | 格式、互動／繪圖、公式、版面（1890×938）皆通過；滑桿全部合法值含端點；`selfCheck` 公式與滑桿同步 |
| 範例數學內容 | 38 項答案與選項以 Python 獨立驗算，全部正確 |
| 截圖目視 | 1920×1080 下分層任務、理解檢查、錯誤分析、滑桿圖、步驟滑桿版面正常 |

## 2026-11-03 第二版：學生向名稱、三層一覽、粵語動畫

| 檔案 | 修改 |
|------|------|
| `assets/phases.json`（三課型） | 階段與小節名稱改為給學生看的任務名稱（例：熱身挑戰、抓錯偵探、最後一關）；原本教師用的名稱移到 `teacher_title`，只用於教案；分層練習階段新增「選擇你的挑戰」頁；新課講授第 2 階段新增「粵語動畫」頁 |
| `assets/lesson.js`、`lesson.css` | 新增 `LS.tiers`（A／B／C 三層題目同頁一覽）、`LS.anim`（分幕動畫＋字幕＋預錄語音；可暫停、拖進度、關聲音；沒有語音檔時改用瀏覽器 zh-HK 語音或只顯示字幕；換頁自動停止；用計時器推進，視窗在背景也會前進） |
| `scripts/new_lesson.py` | 接受 `teacher_title`；新增 `tiers`、`anim` 頁面骨架；教案流程表顯示教師名稱並註明簡報名稱；骨架的計時提醒與左欄文字改為學生向 |
| `scripts/make_audio.py`（新增） | 依 narration.json 用 edge-tts 產生預錄語音 mp3（預設 zh-HK-HiuGaaiNeural）；不安裝套件；會把旁白文字送到微軟朗讀服務 |
| `scripts/verify_deck.js` | `LS.tiers`、`LS.anim` 計入互動頁 |
| 範例（三課型） | 投影畫面移除教師角色文字；新增三層一覽頁；新課範例新增畢氏定理粵語動畫（5 幕、香港粵語語音 5 段）；教案頁碼同步 |

測試（2026-11-03，Edge 無頭模式）：三份範例在 1920×1080（視窗 1890×938）與 1280×720 皆通過格式、互動／繪圖、公式、版面；動畫進度條 501 個值全掃描；內建瀏覽器實際播放動畫，5 段粵語語音依序播完並自動換幕；三份新骨架（含 tiers、anim 頁）通過驗證。

## 已知限制（不擴大宣稱）

- 驗證工具**不點按鈕、不播放聲音**：提示、答案、揭曉、標出錯誤、判準等揭露後的內容，以及動畫的語音與換幕，需要人工操作一遍。
- 粵語語音由 edge-tts（微軟線上朗讀服務）產生，讀音以該服務為準；個別字詞的粵語讀音請教師試聽確認。
- 版面只代表測試的視窗大小；1280×720 容量很小，內容多就要拆頁。教室投影機、其他電腦未實測。
- 只在 Windows＋Edge 測過；macOS／Linux 的瀏覽器路徑需用 `--browser` 指定。
- 範例教案沒有真實課堂資料，學生表現皆為「預期情況」。
- 驗證通過不代表數學正確；每份新教案都要人工核對數學內容。
