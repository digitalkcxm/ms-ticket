const amqp = require("amqplib/callback_api")

function queue() {
  amqp.connect(`amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}?heartbeat=20`, (err, conn) => {
    if (err) {
      console.error(">> [AMQP]", err.message)
      return setTimeout(() => { queue() }, 1000)
    }

    conn.on("error", err => {
      if (err.message !== "Connection closing") {
        console.error("[AMQP] connection error", err.message)
      }
    })

    conn.on("close", () => {
      console.error("[AMQP] reconnecting")
      return setTimeout(() => { queue() }, 1000)
    })

    conn.createChannel((err, ch) => {
      if (err) console.log("Erro ao criar canal. ", err)

      global.amqpConn = ch
    })

  })
}

module.exports = { queue }
