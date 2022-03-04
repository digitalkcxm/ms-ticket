import express from "express";
import { verifyCompany } from "../middlewares/VerifyCompany.js";
import CustomerController from "../controllers/CustomerController.js";

export default function customer(database = {}, logger = {}) {
  const router = express.Router();
  const customerController = new CustomerController(database, logger);
  router.use((req, res, next) =>
    verifyCompany(req, res, next, database, logger)
  );

  router.get("/core/:id_core", (req, res) =>
    customerController.getByIDCore(req, res)
  );
  router.get("/ticket", (req, res) => customerController.getByTicket(req, res));
  router.get("/:id", (req, res) => customerController.getByID(req, res));
  router.post("/", (req, res) => customerController.create(req, res));
  router.put("/:id", (req, res) => customerController.update(req, res));
  return router;
}
