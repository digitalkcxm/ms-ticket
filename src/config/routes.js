import company from "../routes/company.js";
import phase from "../routes/phase.js";
import ticket from "../routes/ticket.js";
// import incoming from "../routes/incoming.js";
import customer from "../routes/customer.js";
import department from "../routes/department.js";

export default (app, database, logger) => {
    app.use("/api/v1/health", (req, res) => res.status(200).send("Ok!"));
  app.use("/api/v1/company", company(database, logger));
  app.use("/api/v1/phase", phase(database, logger));
  app.use("/api/v1/ticket", ticket(database, logger));
  //   app.use("/api/v1/incoming", incoming());
  app.use("/api/v1/customer", customer(database, logger));
  app.use("/api/v1/department", department(database, logger));
};
