import express from "express";
const router = express.Router();

import { verifyCompany } from "../middlewares/VerifyCompany.js";
router.use(verifyCompany);

import PhaseController from "../controllers/PhaseController.js";
import { body } from "express-validator";

export default function phase(database = {}, logger = {}) {
  const phaseController = new PhaseController(database, logger);
  router.get("/cache/", phaseController.getAllPhaseForCache);
  router.get("/socket/:id", phaseController.getBySocket);
  router.get("/dash/:id", phaseController.dash);
  router.get("/filter/", phaseController.filter);
  router.get("/:id", phaseController.getPhaseByID);
  router.get("/", phaseController.getAllPhase);

  router.put("/disable/:id", phaseController.disablePhase);
  router.put("/close_massive/:id", phaseController.closeMassive);
  router.put("/transfer_massive/:id", phaseController.transferMassive);
  router.put("/order/:id", phaseController.orderPhase);

  router.use(
    body("name").notEmpty(),
    body("department").isNumeric(),
    body("form").isBoolean()
    // body("notify").isArray(),
    // body("notify").isArray(),
    // body("active").isBoolean()
  );

  router.post("/", phaseController.create);
  router.put("/:id", phaseController.updatePhase);
  return router
}
