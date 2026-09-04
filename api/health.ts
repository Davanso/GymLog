import type { IncomingMessage, ServerResponse } from 'node:http'
import { checkDatabase } from '../server/db.js'

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    response.statusCode = 405
    response.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    await checkDatabase()
    response.statusCode = 200
    response.end(JSON.stringify({ status: 'ok', database: 'connected' }))
  } catch {
    // Do not log raw driver errors: they may contain connection details.
    response.statusCode = 503
    response.end(JSON.stringify({ status: 'unavailable', database: 'disconnected' }))
  }
}
