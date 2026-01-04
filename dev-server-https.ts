import { createServer } from 'https'
import { parse } from 'url'
import next from 'next'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'threads-sample.meta'
const port = parseInt(process.env.PORT || '8000', 10)

// Certificate directory
const certDir = './cert'

// Find certificate files in cert directory (mkcert generates names like "threads-sample.meta+2.pem")
function findCerts(dir: string) {
  const files = readdirSync(dir)

  // Find key file (ends with -key.pem)
  const keyFile = files.find(f => f.endsWith('-key.pem'))
  // Find cert file (ends with .pem but not -key.pem)
  const certFile = files.find(f => f.endsWith('.pem') && !f.endsWith('-key.pem'))

  if (!keyFile || !certFile) {
    return null
  }

  return {
    key: join(dir, keyFile),
    cert: join(dir, certFile),
  }
}

const certs = findCerts(certDir)

if (!certs) {
  console.error('SSL certificates not found in cert/ directory!')
  console.error('\nTo generate certificates using mkcert, run:')
  console.error('  cd cert')
  console.error('  mkcert threads-sample.meta localhost 127.0.0.1')
  process.exit(1)
}

console.log(`Using SSL certificates:`)
console.log(`  Key: ${certs.key}`)
console.log(`  Cert: ${certs.cert}`)

const key = readFileSync(certs.key, 'utf8')
const cert = readFileSync(certs.cert, 'utf8')

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(
    {
      key,
      cert,
    },
    async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true)
        await handle(req, res, parsedUrl)
      } catch (err) {
        console.error('Error occurred handling', req.url, err)
        res.statusCode = 500
        res.end('internal server error')
      }
    }
  )

  server
    .once('error', (err: Error) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`\n> Ready on https://${hostname}:${port}`)
      console.log('> Press Ctrl+C to stop\n')
    })
})
