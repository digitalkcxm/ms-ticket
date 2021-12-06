const express = require("express");
const { verifyCompany } = require("../middlewares/VerifyCompany");

const router = express.Router();
router.use(verifyCompany);
const { body } = require("express-validator");

const TicketController = require("../controllers/TicketController");
const ticketController = new TicketController();

router.get("/sla_check/:type", (req, res) => ticketController.cronCheckSLA(req, res));~
// type: 1 -> /15 * * * * *
// type: 2 -> /5 * * * * *
// type: 3 -> /30 * * * * *

router.get("/history/:id", (req, res) =>
  ticketController.history_ticket(req, res)
);

router.get("/status", (req, res) =>
  ticketController.ticketStatusCount(req, res)
);
router.get("/count", (req, res) =>
  ticketController.ticketResponsibleCount(req, res)
);

router.get("/socket/:id", (req, res) => ticketController.getTicket(req, res));

router.get("/:id", (req, res) => ticketController.getTicketByID(req, res));

router.get("/protocol/:id", (req, res) =>
  ticketController.getTicketByCustomerOrProtocol(req, res)
);
router.get("/", (req, res) => ticketController.getAllTicket(req, res));

router.post("/activities", (req, res) =>
  ticketController.createActivities(req, res)
);
router.post("/attachments", (req, res) =>
  ticketController.createAttachments(req, res)
);
router.post("/start_ticket", (req, res) =>
  ticketController.startTicket(req, res)
);

router.post("/view", (req, res) => ticketController.viewTicket(req, res));

router.post("/protocol", (req, res) =>
  ticketController.linkProtocolToTicket(req, res)
);
router.put("/close/:id", (req, res) => ticketController.closedTicket(req, res));

router.use(
  body("id_user").isNumeric(),
  body("id_phase").isUUID()
  // body("responsible").isArray()
);

router.post("/", (req, res) => ticketController.create(req, res));
router.put("/:id", (req, res) => ticketController.updateTicket(req, res));


module.exports = router;
