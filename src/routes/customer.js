import express from "express";
import { verifyCompany } from "../middlewares/VerifyCompany.js";
import CustomerController from "../controllers/CustomerController.js";

const router = express.Router();
const customerController = new CustomerController();

export default function customer(database = {}, logger = {}) {
  router.use(verifyCompany);

  router.get("/core/:id_core", customerController.getByIDCore);
  router.get("/ticket", customerController.getByTicket);
  router.get("/:id", customerController.getByID);

  router.post("/", customerController.create);
  router.put("/:id", customerController.update);
  return router;
}
