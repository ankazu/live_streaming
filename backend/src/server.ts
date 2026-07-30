import 'dotenv/config'

import { createServer } from 'node:http'

import { createApp } from './app.js'
import { PrismaUserRepository } from './auth/prisma-repository.js'
import { prisma } from './database/client.js'
import { createSocketServer, notifyStreamEnded } from './socket/server.js'
import { PrismaStreamRepository } from './streams/prisma-repository.js'
import { UserStore } from './auth/store.js'
import { StreamStore } from './streams/store.js'
import { ParticipantManager } from './streams/participants.js'

const port = Number(process.env.PORT ?? 3000)
const userRepository = process.env.DATABASE_URL ? new PrismaUserRepository(prisma) : new UserStore()
const streamRepository = process.env.DATABASE_URL ? new PrismaStreamRepository(prisma) : new StreamStore()
let socketServer: ReturnType<typeof createSocketServer> | undefined
const participantManager = new ParticipantManager()
const app = createApp({
  userRepository,
  streamRepository,
  participantManager,
  onStreamEnded: (streamId) => {
    if (socketServer) notifyStreamEnded(socketServer, streamId)
  },
})
const httpServer = createServer(app)
socketServer = createSocketServer(httpServer, userRepository, streamRepository, participantManager)

const server = httpServer.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
