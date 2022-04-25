import express from "express";
import { verifyCompany } from "../middlewares/VerifyCompany.js";
import ResponsibleController from "../controllers/ResponsibleController.js";

export default function responsible(database = {}, logger = {}) {
  const router = express.Router();
  const responsibleController = new ResponsibleController(database, logger);
  router.use((req, res, next) =>
    verifyCompany(req, res, next, database, logger)
  );

  router.put("/:id", (req, res) => responsibleController.responsibleTicket(req, res));

  return router;
}
