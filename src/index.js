require("dotenv").config();
require("./helpers/CronJob");
const TicketController = require("./controllers/TicketController");

const { setTicketAtRedis } = new TicketController();

const FilaController = require("./controllers/FilaController");
const filaController = new FilaController();

setTicketAtRedis();
require("./config/server").server;

setTimeout(() => {
  filaController.consumerCreateActivity();
  filaController.consumerCreateTicket();
  filaController.consumerUpdateTicket();
  filaController.consumerCreateAttachments();
  filaController.consumerCreateDash();
  filaController.consumerCreateHeader();
}, 2000);
