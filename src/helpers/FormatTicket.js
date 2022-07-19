import moment from "moment";
import SLAController from "../controllers/SLAController.js";
import ResponsibleModel from "../models/ResponsibleModel.js";
import TicketModel from "../models/TicketModel.js";
import asyncRedis from "async-redis";
const redis = asyncRedis.createClient(
  process.env.REDIS_PORT,
  process.env.REDIS_HOST
);
export default class FormatTicket {
  constructor(database = {}, logger = {}) {
    this.slaController = new SLAController(database, logger);
    this.responsibleModel = new ResponsibleModel(database, logger);
    this.ticketModel = new TicketModel(database, logger);
  }

  async retriveTicket(ticket, id_phase) {
    const removeTk = async function (key) {
      let openTickets = await redis.get(key);
      openTickets = JSON.parse(openTickets);
      openTickets = await openTickets.filter((x) => x.id !== ticket.id);
      await redis.set(key, JSON.stringify(openTickets));
    };

    const addTk = async function (key) {
      ticket = await this.formatTicketForPhase({ id: id_phase }, ticket);
      await redis.set(key, JSON.stringify(ticket));
    };

    const validationRemove = {
      1: removeTk(`msTicket:openTickets:${id_phase}`),
      2: removeTk(`msTicket:inProgressTickets:${id_phase}`),
      3: removeTk(`msTicket:closeTickets:${id_phase}`),
    };

    const validationAdd = {
      1: addTk(`msTicket:openTickets:${ticket.id_phase}`),
      2: addTk(`msTicket:inProgressTickets:${ticket.id_phase}`),
      3: addTk(`msTicket:closeTickets:${ticket.id_phase}`),
    };

    let cache = await redis.get(`msTicket:tickets:${id_phase}`);
    cache && (cache = JSON.parse(cache));

    const oldTk = await cache.filter((x) => x.id === ticket.id);

    if (oldTk.length > 0) await validationRemove[oldTk[0].id_status];

    validationAdd[ticket.id_status];
    return ticket;
  }

  async formatTicketForPhase(phase, ticket) {
    ticket.sla = await this.slaController.ticketSLA(phase.id, ticket.id);

    ticket.responsibles =
      await this.responsibleModel.getActiveResponsibleByTicket(ticket.id);
    ticket.created_at = moment(ticket.created_at).format("DD/MM/YYYY HH:mm:ss");
    ticket.updated_at = moment(ticket.updated_at).format("DD/MM/YYYY HH:mm:ss");

    return ticket;
  }
}
