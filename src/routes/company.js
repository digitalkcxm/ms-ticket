const express = require("express")
const CompanyController = require("../controllers/CompanyController")
const { body } = require('express-validator');
const { verifyCompany } = require("../middlewares/VerifyCompany")

const router = express.Router()
const companyController = new CompanyController()

router.get("/", (req, res) => companyController.getByID(req, res))

router.use(
    body("name").notEmpty(),
    body("callback").notEmpty(),
    body("notify_token").notEmpty(),
    body("active").isBoolean()
)


router.post("/", (req, res) => companyController.create(req, res))
router.put("/", verifyCompany, (req, res) => companyController.update(req, res))

module.exports = router