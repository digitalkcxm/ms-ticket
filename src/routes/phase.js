const express = require("express")
const router = express.Router()

const { verifyCompany } = require("../middlewares/VerifyCompany")
router.use(verifyCompany)

const PhaseController = require("../controllers/PhaseController")
const phaseController = new PhaseController()


router.post("/", (req, res) => phaseController.create(req, res))
router.get("/:id", (req, res) => phaseController.getPhaseByID(req, res))
router.get("/", (req, res) => phaseController.getAllPhase(req, res))
router.put("/:id", (req, res) => phaseController.updatePhae(req, res))
module.exports = router