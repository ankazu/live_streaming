# live-streaming

直播平台 MVP，包含前端頁面、使用者認證、直播生命週期管理，以及 LiveKit 串流房間基礎整合。

## 使用技術

- Frontend：Vue 3、TypeScript、Vite、Tailwind CSS、Pinia、Axios
- Backend：Node.js、Express、TypeScript
- Database：Prisma、PostgreSQL（未設定 `DATABASE_URL` 時會使用記憶體儲存）
- Streaming：LiveKit

## 啟動方式

需要 Node.js 22+。

先安裝前後端依賴：

```bash
cd frontend && npm install
cd ../backend && npm install
```

開啟兩個終端機，分別啟動前端與後端：

```bash
# 終端機 1
cd frontend
npm run dev
```

```bash
# 終端機 2
cd backend
npm run dev
```

啟動後：

- Frontend：http://localhost:5173
- Backend health check：http://localhost:3000/api/health

若要使用 PostgreSQL 或 LiveKit，請在 `backend/.env` 設定對應的 `DATABASE_URL`、`LIVEKIT_URL`、`LIVEKIT_API_KEY` 與 `LIVEKIT_API_SECRET`。
