import assert from 'node:assert/strict'
import test from 'node:test'

import { createApp } from '../src/app.js'

test('health endpoint returns a successful service status', async () => {
  const server = createApp().listen(0)
  const address = server.address()

  assert.notEqual(address, null)
  assert.equal(typeof address, 'object')

  const response = await fetch(`http://localhost:${(address as { port: number }).port}/api/health`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.deepEqual(body, {
    success: true,
    data: {
      service: 'live-streaming-backend',
      status: 'ok',
    },
  })

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})
