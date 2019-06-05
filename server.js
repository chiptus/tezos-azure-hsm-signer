#!/usr/bin/env node

const assert = require('assert')
const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')

const hsmClient = require('./models/hsm-client')
const msgClient = require('./models/msg-client')

const {loadKeys} = require('./controllers/load-keys')
const {getAuthorizedKeys} = require('./controllers/get-authorized-keys')
const {getPubKey} = require('./controllers/get-pubkey')
const {signMessage} = require('./controllers/sign-message')
const {handleError} = require('./controllers/handle-error')

const argv = require('yargs')
	.usage('Usage: $0 [options]')
	.alias('M', 'magic-bytes')
	.alias('W', 'check-high-watermark')
	.alias('a', 'address')
	.alias('p', 'port')
	.boolean(['check-high-watermark'])
	.default({M: '*', W: true, a: '127.0.0.1', p: 6732})
	.help('h')
  .alias('h', 'help')
	.argv

const KEYVAULT_URI = process.env.AZURE_KEYVAULT_URI
const ADDRESS = argv.address
const PORT = argv.port
const CHECK_HIGH_WATERMARK = argv.checkHighWatermark
const MAGIC_BYTES = argv.magicBytes

const app = express()
const server = http.createServer(app)

let cachedKeys = {}

app.use(bodyParser.json({strict: false}))
app.get('/authorized_keys', getAuthorizedKeys())
app.get('/keys/:tzKeyHash', getPubKey(cachedKeys))
app.post('/keys/:tzKeyHash', signMessage(cachedKeys, hsmClient, msgClient, KEYVAULT_URI, CHECK_HIGH_WATERMARK, MAGIC_BYTES))

app.get('/listen', (req, res, next) => {
	console.log(req.hostname)
})

app.use(handleError())

server.on('listening', () => {
	console.info(`Server listening at http://${ADDRESS}:${PORT}`)
  console.info(`Loading keys...`)
  loadKeys(hsmClient, KEYVAULT_URI).then((keys) => {
    cachedKeys = keys
    console.info(`Loaded keys OK`)
  }).catch((error) => {
    console.error(`Unable to load keys, exiting`)
    console.error(error)
    process.exit(1)
  })
})

server.on('error', (error) => {
  console.error(`Server encountered error, exiting`)
  console.error(error)
  process.exit(1)
})

server.listen(PORT, ADDRESS)