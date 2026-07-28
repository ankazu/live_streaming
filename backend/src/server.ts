import 'dotenv/config'

import { createApp } from './app.js'
import { PrismaUserRepository } from './auth/prisma-repository.js'
import { prisma } from './database/client.js'
import { PrismaStreamRepository } from './streams/prisma-repository.js'

const port = Number(process.env.PORT ?? 3000)
const app = createApp(
  process.env.DATABASE_URL
    ? {
        userRepository: new PrismaUserRepository(prisma),
        streamRepository: new PrismaStreamRepository(prisma),
      }
    : undefined,
)

const server = app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
