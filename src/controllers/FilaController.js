import PhaseController from "./PhaseController.js";
import TicketController from "./TicketController.js";

export default class FilaController {
  constructor(database = {}, logger = {}) {
    this.logger = logger;
    this.phaseController = new PhaseController(database, logger);
    this.ticketController = new TicketController(database, logger);
  }
  async consumerCreateTicket() {
    const queueName = "msticket:create_ticket";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        this.logger.info("Consumindo create ticket");
        await this.ticketController.queueCreate(JSON.parse(msg.content.toString()));
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      this.logger.error(err,"Error when consume message to create ticket.");
    }
  }

  async consumerUpdateTicket() {
    const queueName = "msticket:update_ticket";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        this.logger.info("Consumindo update ticket");
        await this.ticketController.queueUpdateTicket(
          JSON.parse(msg.content.toString())
        );
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      this.logger.error(err,"Error when consume message to update ticket.");
    }
  }

  async consumerCreateActivity() {
    const queueName = "msticket:create_activities";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        this.logger.info("Consumindo create activities");
        await this.ticketController.queueCreateActivities(
          JSON.parse(msg.content.toString())
        );
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      this.logger.error(err,"Error when consume message to create activity.");
    }
  }

  async consumerCreateAttachments() {
    const queueName = "msticket:create_attachments";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        this.logger.info("Consumindo create attachments");
        await this.ticketController.queueCreateAttachments(
          JSON.parse(msg.content.toString())
        );
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      this.logger.error(err,"Error when consume message to create attachment.");
    }
  }

  async consumerCreateDash() {
    const queueName = "msticket:create_dash";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        this.logger.info("Consumindo create dash.");
        await this.phaseController.dashGenerate(JSON.parse(msg.content.toString()));
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      this.logger.error(err,"Error when consume message to create Dash.");
    }
  }

  async consumerCreateHeader() {
    const queueName = "msticket:create_header";
    try {
      global.amqpConn.assertQueue(queueName, { durable: true });
      global.amqpConn.consume(queueName, async (msg) => {
        this.logger.info("Consumindo create header.");
        await this.phaseController.headerGenerate(
          JSON.parse(msg.content.toString())
        );
        global.amqpConn.ack(msg);
      });
    } catch (err) {
      this.logger.error(err,"Error when consume message to create cache header phase.");
    }
  }

  async sendToQueue(data, queue) {
    try {
      global.amqpConn.assertQueue(queue, { durable: true });
      global.amqpConn.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
        persistent: true,
      });

      return true;
    } catch (err) {
      this.logger.error(err,"ERRO AO PUBLICAR MENSAGEM NA FILA.");
      return false;
    }
  }
}
