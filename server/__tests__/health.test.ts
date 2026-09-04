import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'
import handler from '../../api/health.js'

test('health rejects writes and fails safely without configuration', async () => {
  const previous = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}/api/health`
  try {
    const post = await fetch(url, { method: 'POST' })
    assert.equal(post.status, 405)
    assert.equal(post.headers.get('allow'), 'GET')
    const get = await fetch(url)
    assert.equal(get.status, 503)
    assert.equal(get.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await get.json(), { status: 'unavailable', database: 'disconnected' })
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previous
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
})
