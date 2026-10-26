# 旅購 Travel Studio：測試分支資料庫啟用與驗收

> 本文件僅供測試分支驗收。GitHub 提交 migration **不代表** Supabase 已執行。正式環境不可在未備份、未確認資料庫連線目標前直接套用。

## 1. 已通過的自動檢查
GitHub Actions Preview verification：TypeScript `npx tsc --noEmit`、ESLint `npm run lint`（可有警告）、Next.js `npm run build`。
**自動編譯通過不等於資料庫 CRUD、照片上傳或手機操作驗證通過。**

## 2. Supabase 啟用順序（測試專案優先）
請先確認 Vercel Preview 指向的 Supabase 專案，確認是否與正式站共用資料庫；如共用，先建立備份，切勿直接執行未審核 SQL。

依序檢視並執行：
1. `supabase/migrations/20261026_saved_collections.sql` — 收藏庫與 RLS
2. `supabase/migrations/20261026_collection_photos_storage.sql` — 公開圖片 bucket、本人路徑寫入限制
3. `supabase/migrations/20261026_itinerary_stops.sql` — 行程與 RLS
4. `supabase/migrations/20261026_trip_expenses.sql` — 支出紀錄與 RLS
5. `supabase/migrations/20261026_beta_feedback.sql` — Beta 回饋（僅登入者提交，不公開讀取）

> 目前未從本對話直接執行上述 SQL。權限規則已使用 `drop policy if exists` 重新建立，但仍需在測試環境驗證；請勿將此視為無風險的正式環境更新。

## 3. 驗收清單
- [ ] 登入帳號 A，收藏新增／搜尋／修改／刪除正常，重新整理仍保留
- [ ] 收藏照片（JPG/PNG/WebP/GIF，8 MB 以下）可上傳及顯示，超大或不支援格式會阻擋
- [ ] 商品收藏加入指定旅行購物清單，來源收藏仍保留
- [ ] 景點／餐廳收藏加入指定日期行程，來源收藏仍保留
- [ ] 行程新增、修改、刪除與依日期排序正常
- [ ] 旅行錢包新增、修改、刪除；不同幣別分開加總
- [ ] 登入帳號 B，無法讀取／修改帳號 A 的收藏、行程、支出及照片上傳路徑
- [ ] 既有 trips、shopping_items、trip_covers、trip_budgets 功能及資料不受影響
- [ ] Beta 指南無需登入可開啟；個人功能與站內回饋須登入
- [ ] Beta 回饋可成功送出；一般帳號無法讀取他人回饋
- [ ] 桌機及手機版導覽與表單正常
- [ ] Google Maps 外部搜尋連結正常（**尚未**實作 Google Places API 選點／定位提醒）

## 4. 已知限制
- 目前照片 bucket 為公開讀取；**不適合**私人收據或含個資照片。
- 目前只有基本支出帳本；沒有多人分帳、收據辨識、換匯、與預算自動對帳。
- 景點與美食排入行程仍以輸入日期方式處理，尚未提供拖曳排程。
- 原有旅行預算與新支出帳本分開，不會自動相加。
- 尚未完成實際 Supabase 資料讀寫與跨帳號權限驗證。

## 5. 正式上線門檻
上述驗收項目通過、確認沒有誤連正式資料庫、完成備份與回復方案後，才評估合併測試分支；未獲確認前不得修改正式站。
