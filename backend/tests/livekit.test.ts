import assert from 'node:assert/strict'
import test from 'node:test'

import { createApp } from '../src/app.js'
import { UserStore } from '../src/auth/store.js'
import { StreamStore } from '../src/streams/store.js'
import { ParticipantManager } from '../src/streams/participants.js'

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

async function register(baseUrl: string, email: string) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', displayName: email }),
  })
  assert.equal(response.status, 201)
  return (await response.json()).data as { accessToken: string; user: { id: string } }
}

test('LiveKit token endpoint returns a short-lived owner token when configured', async () => {
  const userStore = new UserStore()
  const streamStore = new StreamStore()
  const app = createApp({
    userStore,
    streamStore,
    liveKitConfig: { apiKey: 'dev-key', apiSecret: 'dev-secret', url: 'wss://example.livekit.cloud' },
  })

  await withServer(async (baseUrl) => {
    const owner = await register(baseUrl, 'livekit-owner@example.com')
    await userStore.setAccountStatus(owner.user.id, 'active')
    const streamResponse = await fetch(`${baseUrl}/api/streams`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + owner.accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'LiveKit test stream' }),
    })
    const stream = (await streamResponse.json()).data.stream
    await fetch(`${baseUrl}/api/streams/${stream.id}/start`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + owner.accessToken },
    })

    const tokenResponse = await fetch(`${baseUrl}/api/livekit/token`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + owner.accessToken, 'content-type': 'application/json' },
      body: JSON.stringify({ streamId: stream.id }),
    })
    const body = await tokenResponse.json()

    assert.equal(tokenResponse.status, 200)
    assert.equal(body.data.url, 'wss://example.livekit.cloud')
    assert.equal(body.data.roomName, `stream-${stream.id}`)
    assert.equal(body.data.canPublish, true)
    assert.equal(typeof body.data.token, 'string')
    assert.equal(body.data.token.split('.').length, 3)
  }, app)
})

test('LiveKit grants publish only to the stream owner', async () => {
  const userStore = new UserStore()
  const streamStore = new StreamStore()
  const app = createApp({
    userStore,
    streamStore,
    liveKitConfig: { apiKey: 'dev-key', apiSecret: 'dev-secret', url: 'wss://example.livekit.cloud' },
  })

  await withServer(async (baseUrl) => {
    const owner = await register(baseUrl, 'owner-only@example.com')
    const participant = await register(baseUrl, 'participant-only@example.com')
    const stream = await streamStore.create({ title: 'Owner grant stream', ownerId: owner.user.id })
    await streamStore.start(stream.id)

    async function tokenFor(accessToken: string) {
      const response = await fetch(`${baseUrl}/api/livekit/token`, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' },
        body: JSON.stringify({ streamId: stream.id }),
      })
      return { response, body: await response.json() }
    }

    const ownerToken = await tokenFor(owner.accessToken)
    const participantToken = await tokenFor(participant.accessToken)
    assert.equal(ownerToken.response.status, 200)
    assert.equal(ownerToken.body.data.canPublish, true)
    assert.equal(participantToken.response.status, 200)
    assert.equal(participantToken.body.data.canPublish, false)
    assert.equal(participantToken.body.data.canSubscribe, true)
  }, app)
})

test('LiveKit grants publish to an approved guest and removes it after host removal', async () => {
  const userStore = new UserStore()
  const streamStore = new StreamStore()
  const participantManager = new ParticipantManager()
  const app = createApp({
    userStore,
    streamStore,
    participantManager,
    liveKitConfig: { apiKey: 'dev-key', apiSecret: 'dev-secret', url: 'wss://example.livekit.cloud' },
  })

  await withServer(async (baseUrl) => {
    const host = await register(baseUrl, 'guest-host@example.com')
    const guest = await register(baseUrl, 'approved-guest@example.com')
    const stream = await streamStore.create({ title: 'Guest grant stream', ownerId: host.user.id })
    await streamStore.start(stream.id)
    participantManager.join(stream.id, { id: host.user.id, displayName: 'Host' }, 'host-socket', true)
    participantManager.join(stream.id, { id: guest.user.id, displayName: 'Guest' }, 'guest-socket', false)
    const request = participantManager.requestToJoin(stream.id, { id: guest.user.id, displayName: 'Guest' })
    participantManager.approve(stream.id, request.id, host.user.id)

    async function tokenFor(accessToken: string) {
      const response = await fetch(`${baseUrl}/api/livekit/token`, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' },
        body: JSON.stringify({ streamId: stream.id }),
      })
      return { response, body: await response.json() }
    }

    const approvedToken = await tokenFor(guest.accessToken)
    assert.equal(approvedToken.response.status, 200)
    assert.equal(approvedToken.body.data.canPublish, true)
    assert.equal(approvedToken.body.data.sessionRole, 'guest')

    participantManager.removeGuest(stream.id, guest.user.id, host.user.id)
    const removedToken = await tokenFor(guest.accessToken)
    assert.equal(removedToken.response.status, 200)
    assert.equal(removedToken.body.data.canPublish, false)
    assert.equal(removedToken.body.data.sessionRole, 'viewer')
  }, app)
})

test('LiveKit token endpoint reports missing configuration', async () => {
  const userStore = new UserStore()
  const streamStore = new StreamStore()
  const app = createApp({ userStore, streamStore, liveKitConfig: {} })

  await withServer(async (baseUrl) => {
    const owner = await register(baseUrl, 'unconfigured-livekit-owner@example.com')
    await userStore.setAccountStatus(owner.user.id, 'active')
    const viewer = await register(baseUrl, 'unconfigured-livekit@example.com')
    const stream = await streamStore.create({ title: 'Unconfigured LiveKit stream', ownerId: owner.user.id })
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

test('LiveKit token endpoint requires an active account', async () => {
  for (const accountStatus of ['pending', 'suspended'] as const) {
    const userStore = new UserStore()
    const streamStore = new StreamStore()
    const app = createApp({
      userStore,
      streamStore,
      liveKitConfig: { apiKey: 'dev-key', apiSecret: 'dev-secret', url: 'wss://example.livekit.cloud' },
    })

    await withServer(async (baseUrl) => {
      const owner = await register(baseUrl, `inactive-${accountStatus}@example.com`)
      const stream = await streamStore.create({ title: `${accountStatus} owner stream`, ownerId: owner.user.id })
      await streamStore.start(stream.id)
      await userStore.setAccountStatus(owner.user.id, accountStatus)

      const response = await fetch(`${baseUrl}/api/livekit/token`, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + owner.accessToken, 'content-type': 'application/json' },
        body: JSON.stringify({ streamId: stream.id }),
      })

      assert.equal(response.status, 403)
      assert.equal((await response.json()).code, 'ACCOUNT_NOT_ACTIVE')
    }, app)
  }
})
