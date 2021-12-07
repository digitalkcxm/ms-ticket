const express = require("express")
const bodyParser = require("body-parser")
const routes = require("./routes.js")
const cors = require("cors")
const app = express()
const connect = require("../config/database/mongoConnection")
const { queue } = require('../config/RabbitMQ')
const moment = require('moment-timezone')


// const agent = require('elastic-apm-node').start({
//     serviceName: 'msticket',
//     serverUrl: process.env.APM
// })

// const Tracer = require('elastic-apm-node-opentracing')

// const tracer = new Tracer(agent)

// const span = tracer.startSpan('http_request');
// span.finish();

const server = require("http").createServer(app)
app.use(cors())
app.use(bodyParser.json({ limit: "256mb", extended: true }))
app.use(bodyParser.urlencoded({ extended: true, limit: "256mb" }))
// app.use(expressValidator())
moment.tz.setDefault('America/Sao_Paulo')

app.use(routes)
queue()

connect(app, () => {
    server.listen(process.env.PORT, () => console.log(`Server running in port ${process.env.PORT}`))
})
module.exports = { server, app }