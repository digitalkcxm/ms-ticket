const express = require("express");
const router = express.Router();

const { verifyCompany } = require("../middlewares/VerifyCompany");
router.use(verifyCompany);

const DepartmentController = require("../controllers/DepartmentController");
const departmentController = new DepartmentController();

router.get("/", (req, res) =>
  departmentController.getCountSLADepartment(req, res)
);


module.exports = router