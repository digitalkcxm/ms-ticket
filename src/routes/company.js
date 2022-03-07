import express from "express";
import CompanyController from "../controllers/CompanyController.js";
import { body } from "express-validator";
import { verifyCompany } from "../middlewares/VerifyCompany.js";

export default function company(database, logger) {
  const router = express.Router();

  const companyController = new CompanyController(database, logger);

  router.get("/", (req, res) => companyController.getByID(req, res));

  router.use(
    body("name").notEmpty(),
    body("callback").notEmpty(),
    body("notify_token").notEmpty(),
    body("active").isBoolean()
  );
  router.post("/", (req, res) => companyController.create(req, res));

  // middleware
  router.use((req, res, next) =>
    verifyCompany(req, res, next, database, logger)
  );

  router.put("/", (req, res) => companyController.update(req, res));
  return router;
}
