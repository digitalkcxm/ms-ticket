import express from "express";
const router = express.Router();

import { verifyCompany } from "../middlewares/VerifyCompany.js";
router.use(verifyCompany);

import DepartmentController from "../controllers/DepartmentController.js";
const departmentController = new DepartmentController();

export default function department(database = {},logger ={}) {
  router.get("/", departmentController.getCountSLADepartment);
  return router;
}
