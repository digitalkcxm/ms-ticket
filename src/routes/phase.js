const express = require("express")
const router = express.Router()

const { verifyCompany } = require("../middlewares/VerifyCompany")
router.use(verifyCompany)

const PhaseController = require("../controllers/PhaseController")
const { body } = require("express-validator")
const phaseController = new PhaseController()

router.get("/:id", (req, res) => phaseController.getPhaseByID(req, res))
router.get("/", (req, res) => phaseController.getAllPhase(req, res))

router.put("/disable/:id", (req, res) => phaseController.disablePhase(req, res))

router.use(
    body("name").notEmpty(),
    body("department").isNumeric(),
    body("unit_of_time").isNumeric(),
    body('sla_time').isNumeric(),
    body("form").isBoolean(),
    body("notify").isArray(),
    body("notify").isArray(),
    body("active").isBoolean()
)

router.post("/", (req, res) => phaseController.create(req, res))
router.put("/:id", (req, res) => phaseController.updatePhase(req, res))


module.exports = router