import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { io as createClient, type Socket } from 'socket.io-client'

import { createApp } from '../src/app.js'
import { createAccessToken } from '../src/auth/token.js'
import { UserStore } from '../src/auth/store.js'
import { createSocketServer, getSocketCorsOrigins, notifyStreamEnded } from '../src/socket/server.js'
import { StreamStore } from '../src/streams/store.js'

function waitForConnect(socket: Socket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve())
    socket.once('connect_error', reject)
  })
}

test('socket CORS allows localhost aliases for local frontend development', () => {
  assert.deepEqual(getSocketCorsOrigins('http://localhost:5173'), [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ])
})

test('authenticated clients can join a live stream and send chat messages', async () => {
  const users = new UserStore()
  const streams = new StreamStore()
  const user = await users.create({ email: 'viewer@example.com', password: 'password123', displayName: 'Viewer', role: 'viewer' })
  const stream = await streams.create({ title: 'Live test', broadcasterId: user.id })
  await streams.start(stream.id)
  const httpServer = createServer(createApp({ userRepository: users, streamRepository: streams }))
  const socketServer = createSocketServer(httpServer, users, streams)

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const token = await createAccessToken(user.id)
  const client = createClient(`http://localhost:${address.port}`, { auth: { token } })

  try {
    await waitForConnect(client)
    const joined = await new Promise<{ success: boolean; viewerCount: number }>((resolve) => {
      client.emit('stream:join', stream.id, resolve)
    })
    assert.deepEqual(joined, { success: true, viewerCount: 1 })

    const received = new Promise<{ content: string; displayName: string }>((resolve) => client.once('chat:message', resolve))
    client.emit('chat:send', 'hello live')
    const message = await received
    assert.equal(message.content, 'hello live')
    assert.equal(message.displayName, 'Viewer')
  } finally {
    client.disconnect()
    socketServer.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  }
})

test('ending a stream notifies every participant in that stream', async () => {
  const users = new UserStore()
  const streams = new StreamStore()
  const broadcaster = await users.create({ email: 'host@example.com', password: 'password123', displayName: 'Host', role: 'broadcaster' })
  users.setAccountStatus(broadcaster.id, 'active')
  const viewer = await users.create({ email: 'audience@example.com', password: 'password123', displayName: 'Audience', role: 'viewer' })
  const stream = await streams.create({ title: 'Ending test', broadcasterId: broadcaster.id })
  await streams.start(stream.id)
  const httpServer = createServer(createApp({ userRepository: users, streamRepository: streams }))
  const socketServer = createSocketServer(httpServer, users, streams)

  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const broadcasterClient = createClient(`http://localhost:${address.port}`, { auth: { token: await createAccessToken(broadcaster.id) } })
  const viewerClient = createClient(`http://localhost:${address.port}`, { auth: { token: await createAccessToken(viewer.id) } })

  try {
    await Promise.all([waitForConnect(broadcasterClient), waitForConnect(viewerClient)])
    await Promise.all([
      new Promise<void>((resolve) => broadcasterClient.emit('stream:join', stream.id, () => resolve())),
      new Promise<void>((resolve) => viewerClient.emit('stream:join', stream.id, () => resolve())),
    ])
    const participantLeft = new Promise<{ userId: string; displayName: string; role: string }>((resolve) =>
      broadcasterClient.once('stream:participant-left', resolve),
    )
    viewerClient.emit('stream:leave')
    assert.deepEqual(await participantLeft, { userId: viewer.id, displayName: 'Audience', role: 'viewer' })

    await new Promise<void>((resolve) => viewerClient.emit('stream:join', stream.id, () => resolve()))
    const notifications = [broadcasterClient, viewerClient].map(
      (client) => new Promise<{ streamId: string }>((resolve) => client.once('stream:ended', resolve)),
    )

    notifyStreamEnded(socketServer, stream.id)

    assert.deepEqual(await Promise.all(notifications), [{ streamId: stream.id }, { streamId: stream.id }])
  } finally {
    broadcasterClient.disconnect()
    viewerClient.disconnect()
    socketServer.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  }
})

test('socket connection without an access token is rejected', async () => {
  const users = new UserStore()
  const streams = new StreamStore()
  const httpServer = createServer(createApp({ userRepository: users, streamRepository: streams }))
  const socketServer = createSocketServer(httpServer, users, streams)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const client = createClient(`http://localhost:${address.port}`)

  try {
    const error = await new Promise<Error>((resolve) => client.once('connect_error', resolve))
    assert.equal(error.message, 'UNAUTHORIZED')
  } finally {
    client.disconnect()
    socketServer.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  }
})

test('stream join failures return an acknowledgement and do not enter the chat room', async () => {
  const users = new UserStore()
  const user = await users.create({ email: 'join-error@example.com', password: 'password123', displayName: 'Join Error', role: 'viewer' })
  const streams = new StreamStore()
  const failingRepository = {
    create: streams.create.bind(streams),
    list: streams.list.bind(streams),
    findById: async () => {
      throw new Error('repository unavailable')
    },
    findByJoinCode: streams.findByJoinCode.bind(streams),
    start: streams.start.bind(streams),
    end: streams.end.bind(streams),
  }
  const httpServer = createServer(createApp({ userRepository: users, streamRepository: failingRepository }))
  const socketServer = createSocketServer(httpServer, users, failingRepository)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const token = await createAccessToken(user.id)
  const client = createClient(`http://localhost:${address.port}`, { auth: { token } })

  try {
    await waitForConnect(client)
    const joined = await new Promise<{ success: boolean; code?: string }>((resolve) => {
      client.emit('stream:join', 'stream-that-failed', resolve)
    })
    assert.deepEqual(joined, { success: false, code: 'JOIN_FAILED' })

    const sent = await new Promise<{ success: boolean; code?: string }>((resolve) => {
      client.emit('chat:send', 'should not be sent', resolve)
    })
    assert.deepEqual(sent, { success: false, code: 'NOT_IN_STREAM' })
  } finally {
    client.disconnect()
    socketServer.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  }
})

test('chat messages are rate limited server-side per authenticated user', async () => {
  const users = new UserStore()
  const streams = new StreamStore()
  const user = await users.create({ email: 'spam@example.com', password: 'password123', displayName: 'Spam', role: 'viewer' })
  const stream = await streams.create({ title: 'Rate limit test', broadcasterId: user.id })
  await streams.start(stream.id)
  const httpServer = createServer(createApp({ userRepository: users, streamRepository: streams }))
  const socketServer = createSocketServer(httpServer, users, streams)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const token = await createAccessToken(user.id)
  const client = createClient(`http://localhost:${address.port}`, { auth: { token } })

  try {
    await waitForConnect(client)
    await new Promise<void>((resolve) => client.emit('stream:join', stream.id, () => resolve()))
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        new Promise<{ success: boolean; code?: string }>((resolve) => {
          client.emit('chat:send', `message ${index}`, resolve)
        }),
      ),
    )
    assert.equal(results.filter((result) => result.success).length, 5)
    assert.deepEqual(results[5], { success: false, code: 'RATE_LIMITED' })
  } finally {
    client.disconnect()
    socketServer.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  }
})
