const express = require("express")
const CompanyController = require("../controllers/CompanyController")

const router = express.Router()
const companyController = new CompanyController()

router.post("/", (req, res) => companyController.create(req, res))
router.get("/", (req, res) => companyController.getByID(req, res))
router.put("/", (req, res) => companyController.update(req, res))

module.exports = router