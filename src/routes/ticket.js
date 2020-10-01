const express = require("express")
const { verifyCompany } = require("../middlewares/VerifyCompany")

const router = express.Router()
router.use(verifyCompany)

const TicketController = require("../controllers/TicketController")
const ticketController = new TicketController()

router.post("/", (req, res) => ticketController.create(req, res))
router.post("/activities", (req, res) => ticketController.createActivities(req, res))
router.post("/attachments", (req, res) => ticketController.createAttachments(req, res))
router.get("/:id", (req, res) => ticketController.getTicketByID(req, res))
router.get("/", (req, res) => ticketController.getAllTicket(req, res))
router.put("/:id", (req, res) => ticketController.updateTicket(req, res))
router.put("/close/:id", (req, res) => ticketController.closedTicket(req, res))
module.exports = router