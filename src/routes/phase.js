import express from "express";
import { body } from "express-validator";
import { verifyCompany } from "../middlewares/VerifyCompany.js";
import PhaseController from "../controllers/PhaseController.js";

export default function phase(database = {}, logger = {}) {
  const router = express.Router();
  const phaseController = new PhaseController(database, logger);
  router.use((req, res, next) =>
    verifyCompany(req, res, next, database, logger)
  );
  router.get("/cache/", (req, res) =>
    phaseController.getAllPhaseForCache(req, res)
  );
  router.get("/socket/:id", (req, res) =>
    phaseController.getBySocket(req, res)
  );
  router.get("/dash/:id", (req, res) => phaseController.dash(req, res));
  router.get("/filter/", (req, res) => phaseController.filter(req, res));
  router.get("/:id", (req, res) => phaseController.getPhaseByID(req, res));
  router.get("/", (req, res) => phaseController.getAllPhase(req, res));

  router.put("/disable/:id", (req, res) =>
    phaseController.disablePhase(req, res)
  );
  router.put("/close_massive/:id", (req, res) =>
    phaseController.closeMassive(req, res)
  );
  router.put("/transfer_massive/:id", (req, res) =>
    phaseController.transferMassive(req, res)
  );
  router.put("/order/:id", (req, res) => phaseController.orderPhase(req, res));

  router.use(
    body("name").notEmpty(),
    body("department").isNumeric(),
    body("form").isBoolean()
    // body("notify").isArray(),
    // body("notify").isArray(),
    // body("active").isBoolean()
  );

  router.post("/", (req, res) => phaseController.create(req, res));
  router.put("/:id", (req, res) => phaseController.updatePhase(req, res));
  return router;
}
