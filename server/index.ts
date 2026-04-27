import { serve } from '@hono/node-server'

import { createApp } from './app.js'

const port = Number.parseInt(process.env.PORT ?? '3000', 10)
const hostname = process.env.HOST ?? '0.0.0.0'
const app = createApp()

const server = serve(
  {
    fetch: app.fetch,
    hostname,
    port,
  },
  (info) => {
    console.log(`Server listening on http://${hostname}:${info.port}`)
  },
)

let isShuttingDown = false

const shutdown = (signal: NodeJS.Signals) => {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  console.log(`Received ${signal}, shutting down`)
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
