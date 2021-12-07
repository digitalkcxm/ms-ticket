    const express = require("express")
const CompanyController = require("../controllers/CompanyController")
const { body } = require('express-validator');
const { verifyCompany } = require("../middlewares/VerifyCompany");
const CustomerController = require("../controllers/CustomerController");

const router = express.Router()
const companyController = new CompanyController()
const customerController = new CustomerController()

router.use(verifyCompany);

router.get("/core/:id_core", (req, res) => customerController.getByIDCore(req, res))
router.get("/ticket", (req, res) => customerController.getByTicket(req, res))
router.get("/:id", (req, res) => customerController.getByID(req, res))


router.post("/", (req, res) => customerController.create(req, res))
router.put("/:id", (req, res) => customerController.update(req, res))

module.exports = router