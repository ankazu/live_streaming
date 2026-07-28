import assert from 'node:assert/strict'
import test from 'node:test'

import { createApp } from '../src/app.js'
import { UserStore } from '../src/auth/store.js'

async function withServer(run: (baseUrl: string) => Promise<void>, app = createApp()) {
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
  const body = await response.json()
  assert.equal(response.status, 201)
  return body.data as { accessToken: string; user: { id: string } }
}

test('broadcaster can create, start, and end a stream', async () => {
  const userStore = new UserStore()
  await withServer(async (baseUrl) => {
    const registered = await register(baseUrl, 'broadcaster@example.com', 'broadcaster')
    userStore.setAccountStatus(registered.user.id, 'active')
    const token = registered.accessToken
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

    const createResponse = await fetch(`${baseUrl}/api/streams`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: '週末音樂現場', description: 'Live session' }),
    })
    const created = await createResponse.json()
    assert.equal(createResponse.status, 201)
    assert.equal(created.data.stream.status, 'scheduled')

    const streamId = created.data.stream.id
    const startResponse = await fetch(`${baseUrl}/api/streams/${streamId}/start`, { method: 'POST', headers })
    const started = await startResponse.json()
    assert.equal(startResponse.status, 200)
    assert.equal(started.data.stream.status, 'live')
    assert.ok(started.data.stream.startedAt)

    const endResponse = await fetch(`${baseUrl}/api/streams/${streamId}/end`, { method: 'POST', headers })
    const ended = await endResponse.json()
    assert.equal(endResponse.status, 200)
    assert.equal(ended.data.stream.status, 'ended')

    const listResponse = await fetch(`${baseUrl}/api/streams`)
    assert.deepEqual((await listResponse.json()).data.items, [])
  }, createApp({ userStore }))
})

test('viewer cannot create a stream or manage another broadcaster stream', async () => {
  await withServer(async (baseUrl) => {
    const broadcasterToken = (await register(baseUrl, 'owner@example.com', 'broadcaster')).accessToken
    const viewerToken = (await register(baseUrl, 'viewer@example.com', 'viewer')).accessToken
    const headers = { authorization: `Bearer ${broadcasterToken}`, 'content-type': 'application/json' }

    const createResponse = await fetch(`${baseUrl}/api/streams`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Private stream' }),
    })
    const streamId = (await createResponse.json()).data.stream.id

    const viewerCreateResponse = await fetch(`${baseUrl}/api/streams`, {
      method: 'POST',
      headers: { authorization: `Bearer ${viewerToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Not allowed' }),
    })
    assert.equal(viewerCreateResponse.status, 403)

    const viewerStartResponse = await fetch(`${baseUrl}/api/streams/${streamId}/start`, {
      method: 'POST',
      headers: { authorization: `Bearer ${viewerToken}` },
    })
    assert.equal(viewerStartResponse.status, 403)
  })
})
