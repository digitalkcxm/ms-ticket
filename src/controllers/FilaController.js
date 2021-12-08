const axios = require("axios");
const moment = require("moment");
const amqp = require("amqplib/callback_api");
const TicketController = require("./TicketController");
const ticketController = new TicketController();

const PhaseController = require("./PhaseController");
const phaseController = new PhaseController();
class FilaController {
  async consumerCreateTicket() {
    const queueName = "msticket:create_ticket";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        console.log("Consumindo create ticket");
        await ticketController.queueCreate(JSON.parse(msg.content.toString()));
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async consumerUpdateTicket() {
    const queueName = "msticket:update_ticket";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        console.log("Consumindo update ticket");
        await ticketController.queueUpdateTicket(
          JSON.parse(msg.content.toString())
        );
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async consumerCreateActivity() {
    const queueName = "msticket:create_activity";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        console.log("Consumindo create activities");
        await ticketController.queueCreateActivities(
          JSON.parse(msg.content.toString())
        );
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async consumerCreateAttachments() {
    const queueName = "msticket:create_attachments";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        console.log("Consumindo create attachments");
        await ticketController.queueCreateAttachments(
          JSON.parse(msg.content.toString())
        );
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async consumerCreateDash() {
    const queueName = "msticket:create_dash";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        console.log("Consumindo create attachments");
        await phaseController._dashGenerate(JSON.parse(msg.content.toString()));
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async sendToQueue(data, queue) {
    try {
      global.amqpConn.createChannel((err, ch) => {
        if (err) console.log("Erro ao criar fila", err);

        ch.assertQueue(queue, { durable: true });
        ch.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
          persistent: true,
        });
      });

      return true;
    } catch (error) {
      console.log("ERRO AO PUBLICAR MENSAGEM NA FILA  ==>>", error);
      return false;
    }
  }
}

module.exports = FilaController;
