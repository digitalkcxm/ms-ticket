import express from "express";
import CompanyController from "../controllers/CompanyController.js";
import { body } from "express-validator";
import { verifyCompany } from "../middlewares/VerifyCompany.js";

export default function company(database, logger) {
  const router = express.Router();

  const companyController = new CompanyController(database, logger);

  router.get("/", companyController.getByID);

  router.use(
    body("name").notEmpty(),
    body("callback").notEmpty(),
    body("notify_token").notEmpty(),
    body("active").isBoolean()
  );
  router.post("/", companyController.create);
  router.put("/", verifyCompany, companyController.update);
  return router
}
