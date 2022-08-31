import amqp from "amqplib/callback_api.js"

export function queue() {
  const connectionConfig = {
    user:     (process.env.NODE_ENV === 'testing') ? process.env.RABBITMQ_USER_TEST     :  process.env.RABBITMQ_USER,
    password: (process.env.NODE_ENV === 'testing') ? process.env.RABBITMQ_PASSWORD_TEST :  process.env.RABBITMQ_PASSWORD,
    host:     (process.env.NODE_ENV === 'testing') ? process.env.RABBITMQ_HOST_TEST     :  process.env.RABBITMQ_HOST,
    port:     (process.env.NODE_ENV === 'testing') ? process.env.RABBITMQ_PORT_TEST     :  process.env.RABBITMQ_PORT
  }

  amqp.connect(`amqp://${connectionConfig.user}:${connectionConfig.password}@${connectionConfig.host}:${connectionConfig.port}?heartbeat=20`, (err, conn) => {
    if (err) {
      console.error(">> [AMQP]", err.message)
      return setTimeout(() => { queue() }, 3000)
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