import express from "express";
import { verifyCompany } from "../middlewares/VerifyCompany.js";
import DepartmentController from "../controllers/DepartmentController.js";

export default function department(database = {}, logger = {}) {
  const router = express.Router();
  const departmentController = new DepartmentController(database, logger);
  router.use((req, res, next) =>
    verifyCompany(req, res, next, database, logger)
  );

  router.get("/", (req, res) =>
    departmentController.getCountSLADepartment(req, res)
  );
  return router;
}
