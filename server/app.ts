import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { logger } from 'hono/logger'

type CreateAppOptions = {
  staticRoot?: string
}

const apiRoutes = [
  { method: 'GET', path: '/api' },
  { method: 'GET', path: '/api/health' },
]

const apiIndex = (c: Context) =>
  c.json({
    service: 'share-sjtu-ng',
    routes: apiRoutes,
  })

export function createApp({ staticRoot = './dist/client' }: CreateAppOptions = {}) {
  const app = new Hono()
  const api = new Hono()

  app.use('*', logger())

  api.get('/', apiIndex)
  api.get('/health', (c) =>
    c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  )

  app.get('/api/', apiIndex)
  app.route('/api', api)
  app.all('/api/*', (c) =>
    c.json(
      {
        error: 'Not Found',
        path: c.req.path,
      },
      404,
    ),
  )

  app.use('*', serveStatic({ root: staticRoot }))
  app.get('*', serveStatic({ root: staticRoot, path: 'index.html' }))

  return app
}
