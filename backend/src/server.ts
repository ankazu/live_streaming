import 'dotenv/config'

import { createServer } from 'node:http'

import { createApp } from './app.js'
import { PrismaUserRepository } from './auth/prisma-repository.js'
import { prisma } from './database/client.js'
import { createSocketServer } from './socket/server.js'
import { PrismaStreamRepository } from './streams/prisma-repository.js'
import { UserStore } from './auth/store.js'
import { StreamStore } from './streams/store.js'

const port = Number(process.env.PORT ?? 3000)
const userRepository = process.env.DATABASE_URL ? new PrismaUserRepository(prisma) : new UserStore()
const streamRepository = process.env.DATABASE_URL ? new PrismaStreamRepository(prisma) : new StreamStore()
const app = createApp({ userRepository, streamRepository })
const httpServer = createServer(app)
createSocketServer(httpServer, userRepository, streamRepository)

const server = httpServer.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
