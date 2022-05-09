import moment from "moment";

import TicketModel from "../models/TicketModel.js";

// const UnitOfTimeModel = require("../models/UnitOfTimeModel");

// const AttachmentsModel = require("../models/AttachmentsModel");
// const attachmentsModel = new AttachmentsModel();

// const ActivitiesModel = require("../models/ActivitiesModel");
// const activitiesModel = new ActivitiesModel();

import SLAController from "../controllers/SLAController.js";

export async function formatTicketForPhase(phase, ticket, database, logger) {
  const ticketModel = new TicketModel(database, logger);
  const slaController = new SLAController(database, logger);

  ticket.sla = await slaController.ticketSLA(phase.id, ticket.id);

  ticket.start_ticket
    ? (ticket.start_ticket = moment(ticket.start_ticket).format(
        "DD/MM/YYYY HH:mm:ss"
      ))
    : "";
  ticket.created_at = moment(ticket.created_at).format("DD/MM/YYYY HH:mm:ss");
  ticket.updated_at = moment(ticket.updated_at).format("DD/MM/YYYY HH:mm:ss");
  const responsible = await ticketModel.getLastResponsibleTicket(ticket.id);

  responsible && responsible.name
    ? (ticket.responsible = responsible.name)
    : (ticket.responsible = "");

  delete ticket.id_company;
  delete ticket.id_form;

  return ticket;
}

export async function formatClosedTickets(redis, authorization, phase, props) {
  let tickets = await redis.get(
    `msTicket:header:${authorization}:closeTickets:${phase.id}`
  );

  if (tickets) {
    return JSON.parse(tickets);
  } else {
    tickets = await props.ticketModel.getTicketByPhaseAndStatus(phase.id, [true]);

    for await (let ticket of tickets) {
      await formatTicketForPhase(phase, ticket, props.database, props.logger);
    }
    
    await redis.set(
      `msTicket:header:${authorization}:closeTickets:${phase.id}`,
      JSON.stringify(tickets)
    );
    return tickets;
  }
}
