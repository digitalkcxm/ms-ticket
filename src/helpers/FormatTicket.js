import moment from "moment";
import SLAController from "../controllers/SLAController.js";
import ResponsibleModel from "../models/ResponsibleModel.js";
import TicketModel from "../models/TicketModel.js";

export default class FormatTicket {
  constructor(database = {}, logger = {}) {
    this.slaController = new SLAController(database, logger);
    this.responsibleModel = new ResponsibleModel(database, logger);
    this.ticketModel = new TicketModel(database, logger);
  }
  async phaseFormat(phase, tickets) {
    console.log("phase", tickets);
    phase.sla &&
      (await tickets.map((ticket) =>
        this.slaController.ticketSLA(phase.id, ticket.id)
      ));

    tickets && Array.isArray(tickets) &&
      (await tickets.map(
        async (ticket) =>
          (ticket.responsible =
            await this.responsibleModel.getAllResponsibleByTicket(ticket.id)) &&
          (ticket.updated_at = moment(ticket.updated_at).format(
            "DD/MM/YYYY HH:mm:ss"
          ))
      ));

    return tickets;
  }

  async formatTicketForPhase(phase, ticket) {
    phase.sla &&
      (ticket.sla = await this.slaController.ticketSLA(phase.id, ticket.id));

    // ticket.created_at = moment(ticket.created_at).format("DD/MM/YYYY HH:mm:ss");
    ticket.updated_at = moment(ticket.updated_at).format("DD/MM/YYYY HH:mm:ss");
    ticket.responsible = await this.responsibleModel.getAllResponsibleByTicket(
      ticket.id
    );
    return ticket;
  }

  async formatClosedTickets(redis, authorization, phase) {
    let tickets = await redis.get(
      `msTicket:header:${authorization}:closeTickets:${phase.id}`
    );

    if (tickets) {
      return JSON.parse(tickets);
    } else {
      tickets = await this.ticketModel.getTicketByPhaseAndStatus(phase.id, [
        true,
      ]);

      for await (let ticket of tickets) {
        await this.formatTicketForPhase(phase, ticket);
      }

      await redis.set(
        `msTicket:header:${authorization}:closeTickets:${phase.id}`,
        JSON.stringify(tickets)
      );
      return tickets;
    }
  }
}
