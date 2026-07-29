import cors from 'cors'
import express from 'express'

import type { UserRepository } from './auth/repository.js'
import { UserStore } from './auth/store.js'
import { createAuthRouter } from './auth/routes.js'
import type { StreamRepository } from './streams/repository.js'
import { createStreamRouter } from './streams/routes.js'
import { StreamStore } from './streams/store.js'
import { createLiveKitRouter } from './livekit/routes.js'
import type { LiveKitConfig } from './livekit/service.js'

export function createApp(dependencies: { userRepository?: UserRepository; streamRepository?: StreamRepository; userStore?: UserStore; streamStore?: StreamStore; liveKitConfig?: LiveKitConfig; onStreamEnded?: (streamId: string) => void } = {}) {
  const app = express()

  app.use(cors())
  app.use(express.json())

  const userRepository = dependencies.userRepository ?? dependencies.userStore ?? new UserStore()
  const auth = createAuthRouter(userRepository)
  app.use('/api/auth', auth.router)

  const streamRepository = dependencies.streamRepository ?? dependencies.streamStore ?? new StreamStore()
  const streams = createStreamRouter(auth.userRepository, streamRepository, { onStreamEnded: dependencies.onStreamEnded })
  app.use('/api/streams', streams.router)
  app.use('/api/livekit', createLiveKitRouter(auth.userRepository, streams.streamRepository, dependencies.liveKitConfig ?? {
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
    url: process.env.LIVEKIT_URL,
  }))

  app.get('/api/health', (_request, response) => {
    response.json({
      success: true,
      data: {
        service: 'live-streaming-backend',
        status: 'ok',
      },
    })
  })

  return app
}
