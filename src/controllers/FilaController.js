const axios = require('axios')
const moment = require('moment')
const amqp = require('amqplib/callback_api')
const TicketController = require('./TicketController')
const ticketController = new TicketController()

class FilaController {
    async consumerCreateTicket(){
      const queueName = 'msticket:create_ticket'
        try {
          global.amqpConn.assertQueue(queueName, { durable: true })
          console.log("Consumindo create ticket")
          global.amqpConn.consume(queueName, async msg => {
            await ticketController.queueCreate(JSON.parse(msg.content.toString()))
            global.amqpConn.ack(msg)
          })
        } catch (err) {
          console.log(err)
        }
      }

    async consumerUpdateTicket() {
      const queueName = 'msticket:update_ticket'
        try {
            global.amqpConn.assertQueue(queueName, { durable: true })
            console.log("Consumindo update ticket")
            global.amqpConn.consume(queueName, async msg => {
              await ticketController.queueUpdateTicket(JSON.parse(msg.content.toString()))
              global.amqpConn.ack(msg)
            })
          } catch (err) {
            console.log(err)
          }
    }

    async consumerCreateActivity() {
      const queueName = 'msticket:create_activity'
        try {
            global.amqpConn.assertQueue(queueName, { durable: true })
            console.log("Consumindo create activities")
            global.amqpConn.consume(queueName, async msg => {
                await ticketController.queueCreateActivities(JSON.parse(msg.content.toString()))
                global.amqpConn.ack(msg)
            })
        } catch (err) {
            console.log(err)
        }
    }
}

module.exports = FilaController;
