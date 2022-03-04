import express from "express";
import bodyParser from "body-parser";
import routes from "./routes.js";
import cors from "cors";
const app = express();
import connect from "../config/database/mongoConnection.js";
import { queue } from "../config/RabbitMQ.js";
import moment from "moment-timezone";
import http from "http";
import database from "./database/database.js";
import logger from "./logger.js";

import FilaController from "../controllers/FilaController.js";

const server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json({ limit: "256mb", extended: true }));
app.use(bodyParser.urlencoded({ extended: true, limit: "256mb" }));
// app.use(expressValidator())
moment.tz.setDefault("America/Sao_Paulo");

routes(app, database, logger);
// app.use(routes);
queue();

connect(app, () => {
  server.listen(process.env.PORT, () =>
    console.log(`Server running in port ${process.env.PORT}`)
  );
});

const filaController = new FilaController(database, logger);

setTimeout(() => {
  filaController.consumerCreateActivity();
  filaController.consumerCreateTicket();
  filaController.consumerUpdateTicket();
  filaController.consumerCreateAttachments();
  filaController.consumerCreateDash();
  filaController.consumerCreateHeader();
}, 5000);

export { server, app, database, logger };
