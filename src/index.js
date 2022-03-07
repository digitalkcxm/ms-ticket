import dotenv from "dotenv";
import TicketController from "./controllers/TicketController.js";

import { server, database, logger } from "./config/server.js";

const ticketController = new TicketController(database, logger);
ticketController.setTicketAtRedis();

server;
