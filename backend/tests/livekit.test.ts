import assert from 'node:assert/strict'
import test from 'node:test'

import { createApp } from '../src/app.js'
import { UserStore } from '../src/auth/store.js'
import { StreamStore } from '../src/streams/store.js'

async function withServer(run: (baseUrl: string) => Promise<void>, app: ReturnType<typeof createApp>) {
  const server = app.listen(0)
  const address = server.address() as { port: number }

  try {
    await run(`http://localhost:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

async function register(baseUrl: string, email: string, role: 'viewer' | 'broadcaster') {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', displayName: role, role }),
  })
  assert.equal(response.status, 201)
  return (await response.json()).data as { accessToken: string; user: { id: string } }
}

test('LiveKit token endpoint returns a short-lived viewer token when configured', async () => {
  const userStore = new UserStore()
  const streamStore = new StreamStore()
  const app = createApp({
    userStore,
    streamStore,
    liveKitConfig: { apiKey: 'dev-key', apiSecret: 'dev-secret', url: 'wss://example.livekit.cloud' },
  })

  await withServer(async (baseUrl) => {
    const broadcaster = await register(baseUrl, 'livekit-owner@example.com', 'broadcaster')
    await userStore.setAccountStatus(broadcaster.user.id, 'active')
    const viewer = await register(baseUrl, 'livekit-viewer@example.com', 'viewer')
    const streamResponse = await fetch(`${baseUrl}/api/streams`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + broadcaster.accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'LiveKit test stream' }),
    })
    const stream = (await streamResponse.json()).data.stream
    await fetch(`${baseUrl}/api/streams/${stream.id}/start`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + broadcaster.accessToken },
    })

    const tokenResponse = await fetch(`${baseUrl}/api/livekit/token`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + viewer.accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({ streamId: stream.id }),
    })
    const body = await tokenResponse.json()

    assert.equal(tokenResponse.status, 200)
    assert.equal(body.data.url, 'wss://example.livekit.cloud')
    assert.equal(body.data.roomName, `stream-${stream.id}`)
    assert.equal(body.data.canPublish, false)
    assert.ok(body.data.token)
  }, app)
})

test('LiveKit token endpoint reports missing configuration', async () => {
  const userStore = new UserStore()
  const streamStore = new StreamStore()
  const app = createApp({ userStore, streamStore, liveKitConfig: {} })

  await withServer(async (baseUrl) => {
    const broadcaster = await register(baseUrl, 'unconfigured-livekit-owner@example.com', 'broadcaster')
    await userStore.setAccountStatus(broadcaster.user.id, 'active')
    const viewer = await register(baseUrl, 'unconfigured-livekit@example.com', 'viewer')
    const stream = await streamStore.create({ title: 'Unconfigured LiveKit stream', broadcasterId: broadcaster.user.id })
    await streamStore.start(stream.id)
    const response = await fetch(`${baseUrl}/api/livekit/token`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + viewer.accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({ streamId: stream.id }),
    })

    assert.equal(response.status, 503)
    assert.equal((await response.json()).code, 'LIVEKIT_NOT_CONFIGURED')
  }, app)
})
