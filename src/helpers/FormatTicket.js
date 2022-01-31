const moment = require("moment");

const TicketModel = require("../models/TicketModel");
const ticketModel = new TicketModel();

// const UnitOfTimeModel = require("../models/UnitOfTimeModel");

// const AttachmentsModel = require("../models/AttachmentsModel");
// const attachmentsModel = new AttachmentsModel();

// const ActivitiesModel = require("../models/ActivitiesModel");
// const activitiesModel = new ActivitiesModel();

const { ticketSLA } = require("./SLAFormat");

async function formatTicketForPhase(phase, ticket) {
  ticket.sla = await ticketSLA(phase.id, ticket.id);

  ticket.start_ticket
    ? (ticket.start_ticket = moment(ticket.start_ticket).format(
        "DD/MM/YYYY HH:mm:ss"
      ))
    : "";
  ticket.created_at = moment(ticket.created_at).format("DD/MM/YYYY HH:mm:ss");
  ticket.updated_at = moment(ticket.updated_at).format("DD/MM/YYYY HH:mm:ss");
  ticket.responsible = await ticketModel.getLastResponsibleTicket(ticket.id);
  delete ticket.id_company;
  delete ticket.id_form;

  return ticket;
}

module.exports = { formatTicketForPhase };
