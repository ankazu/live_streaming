import assert from 'node:assert/strict'
import test from 'node:test'

import { createApp } from '../src/app.js'

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createApp().listen(0)
  const address = server.address() as { port: number }

  try {
    await run(`http://localhost:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

test('viewer can register, login, and fetch the current user', async () => {
  await withServer(async (baseUrl) => {
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'viewer@example.com',
        password: 'password123',
        displayName: 'Viewer One',
        role: 'viewer',
      }),
    })
    const registered = await registerResponse.json()

    assert.equal(registerResponse.status, 201)
    assert.equal(registered.success, true)
    assert.equal(registered.data.user.role, 'viewer')
    assert.ok(registered.data.accessToken)
    assert.equal(registered.data.user.passwordHash, undefined)

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@example.com', password: 'password123' }),
    })
    const loggedIn = await loginResponse.json()

    assert.equal(loginResponse.status, 200)
    assert.ok(loggedIn.data.accessToken)

    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { authorization: `Bearer ${loggedIn.data.accessToken}` },
    })
    const me = await meResponse.json()

    assert.equal(meResponse.status, 200)
    assert.equal(me.data.user.email, 'viewer@example.com')
  })
})

test('public registration rejects admin role', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123',
        displayName: 'Admin',
        role: 'admin',
      }),
    })

    assert.equal(response.status, 400)
    assert.equal((await response.json()).code, 'INVALID_ROLE')
  })
})
