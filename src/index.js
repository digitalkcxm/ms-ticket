import dotenv from "dotenv";
import TicketController from "./controllers/TicketController.js"

const { setTicketAtRedis } = new TicketController();



setTicketAtRedis();
import { server } from "./config/server.js";

server

