const TicketModel = require("../models/TicketModel");
const ticketModel = new TicketModel();

const PhaseModel = require("../models/PhaseModel");
const phaseModel = new PhaseModel();

const CompanyModel = require("../models/CompanyModel");
const companyModel = new CompanyModel();

async function notify(id_phase, id_ticket, id_company, action) {
  const ticket = await ticketModel.getTicketById(id_ticket);

  const phase = await phaseModel.getPhaseById(id_phase);

  const company = await companyModel.getById(id_company);


  switch (action) {
    case "open_ticket":
        phase[0].admin
      break;
    case "progress_ticket":
      break;
    case "close_ticket":
      break;
    case "sla_start_ticket":
      break;
    case "first_reply":
      break;
    case "complete_ticket":
      break;
    default:
      break;
  }
}

module.exports = { notify };
