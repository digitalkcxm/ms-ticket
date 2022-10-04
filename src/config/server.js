import express from 'express'
import bodyParser from 'body-parser'
import routes from './routes.js'
import cors from 'cors'
const app = express()
import connect from '../config/database/mongoConnection.js'
import { queue } from '../config/RabbitMQ.js'
import moment from 'moment-timezone'
import http from 'http'
import database from './database/database.js'
import logger from './logger.js'

import Redis from './redis.js'
import FilaController from '../controllers/FilaController.js'

import CacheController from '../controllers/CacheController.js'

const server = http.createServer(app)

const redis = Redis.newConnection()

app.use(cors())
app.use(bodyParser.json({ limit: '256mb', extended: true }))
app.use(bodyParser.urlencoded({ extended: true, limit: '256mb' }))
// app.use(expressValidator())
moment.tz.setDefault('America/Sao_Paulo')

routes(app, database, logger, redis)
// app.use(routes);
queue()

const port = process.env.PORT || 3000

await connect(app, () => {
  server.listen(port, () => console.log(`Server running in port ${port}`))
})

const filaController = new FilaController(database, logger, redis)
const cache  = new CacheController(database, logger, redis)
setTimeout(() => {
  filaController.consumerCreateActivity()
  filaController.consumerCreateTicket()
  filaController.consumerUpdateTicket()
  filaController.consumerCreateAttachments()
  filaController.consumerCreateDash()
  filaController.consumerCreateHeader()
  cache.cachePhase()
}, 5000)

export { server, app }
