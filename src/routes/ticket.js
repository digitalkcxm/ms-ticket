const express = require("express")
const { verifyCompany } = require("../middlewares/VerifyCompany")

const router = express.Router()
router.use(verifyCompany)

const TicketController = require("../controllers/TicketController")
const ticketController = new TicketController()

router.post("/", (req, res) => ticketController.create(req, res))

module.exports = router
