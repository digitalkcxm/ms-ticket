const axios = require('axios')
const moment = require('moment')
const amqp = require('amqplib/callback_api')
const TicketController = require('./TicketController')
const ticketController = new TicketController()

class FilaController {
    async consumerCreateTicket(){
        try {
          const queueName = 'msticket:create_ticket'
    
          global.amqpConn.assertQueue(queueName, { durable: true })
          global.amqpConn.consume(queueName, async msg => {
            await ticketController.queueCreate(JSON.parse(msg.content.toString()))
            global.amqpConn.ack(msg)
          })
        } catch (err) {
          console.log(err)
        }
      }

    async consumerUpdateTicket() {
        try {
            const queueName = 'msticket:update_ticket'
      
            global.amqpConn.assertQueue(queueName, { durable: true })
            global.amqpConn.consume(queueName, async msg => {
              await ticketController.queueUpdateTicket(JSON.parse(msg.content.toString()))
              global.amqpConn.ack(msg)
            })
          } catch (err) {
            console.log(err)
          }
    }

    async consumerCreateActivity() {
        try {
            const queueName = 'msticket:create_activity'
    
            global.amqpConn.assertQueue(queueName, { durable: true })
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
