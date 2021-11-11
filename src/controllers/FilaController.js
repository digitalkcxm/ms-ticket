const axios = require('axios')
const moment = require('moment')
const amqp = require('amqplib/callback_api')
const TicketController = require('./TicketController')
const ticketController = new TicketController()

class FilaController {
    async consumerCreateTicket() {
        try {
            amqp.connect(
                `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`,
                (err, conn) => {
                if (err) console.log('Erro ao conectar ao RabbitMQ => ', err)
        
                conn.createChannel((err, ch) => {
                    if (err) console.log('Erro ao criar fila => ', err)
        
                    const queueName = 'msticket:create_ticket'
        
                    ch.assertQueue(queueName, { durable: true })
                    ch.prefetch(1)
                    ch.consume(
                    queueName,
                    async (msg) => {
                        console.log("consumindo")
                        await ticketController.queueCreate(JSON.parse(msg.content.toString()))
                    },
                    { noAck: true }
                    )
                })
                }
            )
        } catch (err) {
            console.log('ERROR FILA CLOSE PROTOCOL ==>>', err)
        }
    }

    async consumerUpdateTicket() {
        try {
            amqp.connect(
            `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`,
            (err, conn) => {
                if (err) console.log('Erro ao conectar ao RabbitMQ => ', err)
    
                conn.createChannel((err, ch) => {
                if (err) console.log('Erro ao criar fila => ', err)
    
                const queueName = 'msticket:update_ticket'
    
                ch.assertQueue(queueName, { durable: true })
                ch.prefetch(1)
                ch.consume(
                    queueName,
                    async (msg) => {
                        console.log("consumindo")
                        await ticketController.queueUpdate(JSON.parse(msg.content.toString()))
                    },
                    { noAck: true }
                )
                })
            }
            )
        } catch (err) {
            console.log('ERROR FILA CLOSE PROTOCOL ==>>', err)
        }
    }

async consumerCreateActivity() {
    try {
        amqp.connect(
          `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`,
          (err, conn) => {
            if (err) console.log('Erro ao conectar ao RabbitMQ => ', err)
  
            conn.createChannel((err, ch) => {
              if (err) console.log('Erro ao criar fila => ', err)
  
              const queueName = 'msticket:create_activity'
  
              ch.assertQueue(queueName, { durable: true })
              ch.prefetch(1)
              ch.consume(
                queueName,
                async (msg) => {
                    console.log("consumindo")
                    await ticketController.queueCreateActivities(JSON.parse(msg.content.toString()))
                },
                { noAck: true }
              )
            })
          }
        )
    } catch (err) {
        console.log('ERROR FILA CLOSE PROTOCOL ==>>', err)
    }
}
}

module.exports = FilaController;
