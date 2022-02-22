import express from "express";
import { verifyCompany } from "../middlewares/VerifyCompany.js";

const router = express.Router();
router.use(verifyCompany);

import TicketController from "../controllers/TicketController.js";

export default function ticket(database = {}, logger = {}) {
  const ticketController = new TicketController(database, logger);

  router.get("/sla_check/:type", ticketController.cronCheckSLA);
  // type: 1 -> /15 * * * * *
  // type: 2 -> /5 * * * * *
  // type: 3 -> /30 * * * * *

  router.get("/history/:id", ticketController.history_ticket);

  router.get("/status", ticketController.ticketStatusCount);
  router.get("/count", ticketController.ticketResponsibleCount);

  router.get("/socket/:id", ticketController.getTicket);

  router.get("/:id", ticketController.getTicketByID);

  router.get("/protocol/:id", ticketController.getTicketByCustomerOrProtocol);
  router.get("/", ticketController.getAllTicket);

  router.post("/activities", ticketController.createActivities);
  router.post("/attachments", ticketController.createAttachments);
  router.post("/start_ticket", ticketController.startTicket);

  router.post("/view", ticketController.viewTicket);

  router.post("/protocol", ticketController.linkProtocolToTicket);
  router.put("/close/:id", ticketController.closedTicket);

  router.post("/tab", ticketController.tab);
  // router.post("/",  ticketController.create)
  //router.put("/:id",  ticketController.queueUpdateTicket)

  return router;
}
