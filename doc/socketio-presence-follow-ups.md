# Socket.IO presence follow-up

狀態：延後處理
優先級：P1
記錄日期：2026-07-29

## 問題

`backend/src/socket/server.ts` 的 `stream:join` 成功後，目前只會：

- 對新加入者發送 `presence:snapshot`
- 對既有 client 發送 `presence:joined`

成功加入後沒有對整個 room broadcast `presence:count`，因此已在房間內的 client 可能持續顯示加入前的舊在線人數。

## 預計修正

在成功加入直播 room、更新 `streamPresence` 後補上：

```ts
io.to(roomName(stream.id)).emit('presence:count', {
  viewerCount: streamPresence.size,
})
```

這次先不修改，保留為後續實作待辦。

## 驗收條件

- 新 client 成功加入 live stream 後，room 內所有 client 都收到最新 `presence:count`。
- 既有 client 的 UI 在線人數會從 N 更新為 N+1。
- 加入失敗時不 broadcast 人數事件。
- 離開與斷線仍維持目前 presence 清理行為。
- 新增至少兩個 Socket.IO client 的 integration test，確認既有 client 與新 client 都收到最新人數。

## 相關檔案

- `backend/src/socket/server.ts`
- `backend/tests/socket.test.ts`
- `frontend/src/components/LiveKitRoom.vue`
