const express = require("express")
const PhaseController = require("../controllers/PhaseController")

const router = express.Router()
const phaseController = new PhaseController()

router.post("/", (req, res) => phaseController.create(req, res))

module.exports = router