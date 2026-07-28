# live-streaming frontend

直播平台 MVP 的前端應用，提供觀眾探索直播、登入／註冊，以及 broadcaster 建立與管理直播的介面。前端透過 Axios 呼叫 backend API，並使用 LiveKit Client 進入正在進行的直播房間。

## 功能

- 首頁 hero、直播列表與「How it works」介紹區塊
- 依標題與簡介搜尋直播，支援載入中、錯誤與空狀態
- viewer／broadcaster 登入與公開註冊 modal
- 啟動時自動還原登入 session
- 統一處理 access token 與 `401 Unauthorized`
- broadcaster studio：建立直播、開始直播、結束直播
- 已登入使用者可從 live stream 進入 LiveKit room
- Tailwind CSS responsive UI

## 技術棧

- Vue 3 + `<script setup>`
- TypeScript
- Vite
- Tailwind CSS v4 + `@tailwindcss/vite`
- Pinia：登入狀態與使用者 session
- Axios：HTTP client 與 API interceptor
- LiveKit Client：直播房間連線與遠端 media track
- Vitest + Vue Test Utils + jsdom：前端測試
- Prettier + `prettier-plugin-tailwindcss`：格式化與 Tailwind class 排序

## 環境需求

- Node.js 22+
- npm
- 已啟動的 backend API（預設 `http://localhost:3000`）

如果本機使用專案既有 Node 環境，可先執行：

```bash
export PATH=/Users/Zhou/.local/bin:$PATH
```

## 安裝與啟動

在 `frontend/` 目錄執行：

```bash
npm install
npm run dev
```

Vite 開發伺服器預設位於 `http://localhost:5173`。

另開終端機啟動 backend：

```bash
cd ../backend
npm install
npm run dev
```

## 環境變數

前端可在 `frontend/.env.local` 覆寫 backend API base URL：

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api
```

若未設定，`src/api/client.ts` 會使用上述預設值。所有以 `VITE_` 開頭的變數都會被打包至瀏覽器，不能放入 LiveKit API secret、JWT secret 或其他敏感憑證。

LiveKit 的 API key 與 secret 僅設定在 backend。前端只會從 `POST /api/livekit/token` 取得短效 token、LiveKit URL、room name 與 publish 權限。

## npm scripts

| 指令                   | 用途                                            |
| ---------------------- | ----------------------------------------------- |
| `npm run dev`          | 啟動 Vite 開發伺服器                            |
| `npm run build`        | 執行 `vue-tsc` 型別檢查並建立 production bundle |
| `npm run preview`      | 預覽 production bundle                          |
| `npm test`             | 執行 Vitest 測試一次                            |
| `npm run format`       | 使用 Prettier 格式化前端檔案                    |
| `npm run format:check` | 檢查檔案是否符合格式規則                        |

建議在提交前執行：

```bash
npm run format:check
npm test
npm run build
```

## 前端目錄

```text
src/
├── api/
│   ├── client.ts       # Axios instance、token interceptor、401 handling
│   ├── auth.ts         # 登入、註冊、目前使用者
│   ├── streams.ts      # 直播列表與 lifecycle API
│   └── livekit.ts      # LiveKit token API
├── components/
│   ├── AuthModal.vue
│   ├── BroadcasterStudio.vue
│   ├── HeroSection.vue
│   ├── LiveKitRoom.vue
│   ├── SiteHeader.vue
│   └── StreamGrid.vue
├── stores/auth/store.ts # Pinia auth store
├── types/               # auth／stream TypeScript types
├── App.vue              # 頁面組合與少量頁面狀態
├── main.ts              # Vue、Pinia 啟動入口
└── style.css            # Tailwind import 與共用 theme primitives
```

API module 採扁平 feature naming：`src/api/auth.ts`、`src/api/streams.ts`。Vue components 不直接呼叫 Axios，應透過 `src/api/` 的 typed functions 存取 backend。

## Backend API 依賴

目前前端使用以下 endpoint：

### Authentication

- `POST /api/auth/register`：註冊 `viewer` 或 `broadcaster`
- `POST /api/auth/login`：登入並取得 access token
- `GET /api/auth/me`：取得目前登入使用者

access token 目前暫存在 `localStorage` 的 `live-streaming.access-token`，Axios request interceptor 會自動加入 Bearer token。

### Streams

- `GET /api/streams`：取得尚未結束的直播
- `POST /api/streams`：broadcaster 建立直播
- `POST /api/streams/:id/start`：直播擁有者開始直播
- `POST /api/streams/:id/end`：直播擁有者結束直播

### LiveKit

- `POST /api/livekit/token`：依 `streamId` 取得短效 LiveKit token

後端會依角色簽發權限：broadcaster 可 publish／subscribe，viewer 僅能 subscribe。未登入使用者點擊 `Watch live` 時，前端會先開啟登入 modal。

## 開發注意事項

- backend 必須先啟動，直播列表與認證功能才可正常使用。
- broadcaster 預設可能是 `pending`，通過審核前無法建立或開始直播。
- 真實 LiveKit Cloud 或 self-hosted server 尚未在此 frontend 端設定；需要 backend 提供有效的 token 與 LiveKit URL。
- localStorage token 僅是 MVP 方案。Production 應評估 HttpOnly、Secure cookie 或其他較能降低 XSS 風險的 session 設計，並一併處理 CSRF、token expiry 與 session recovery。
- 前端 API 預設 timeout 為 10 秒；收到 401 時會清除 token 並通知 auth store，將使用者導回登入流程。

## 相關文件

- [`../README.md`](../README.md)：專案總覽與 backend／frontend 啟動方式
- [`../doc/live-streaming-plan.md`](../doc/live-streaming-plan.md)：MVP 分階段開發計畫
