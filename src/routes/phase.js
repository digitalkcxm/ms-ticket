const express = require("express")
const router = express.Router()

const { verifyCompany } = require("../middlewares/VerifyCompany")
router.use(verifyCompany)

const PhaseController = require("../controllers/PhaseController")
const phaseController = new PhaseController()


router.post("/", (req, res) => phaseController.create(req, res))

module.exports = router