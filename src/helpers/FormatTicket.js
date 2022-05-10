import moment from "moment";



// const UnitOfTimeModel = require("../models/UnitOfTimeModel");

// const AttachmentsModel = require("../models/AttachmentsModel");
// const attachmentsModel = new AttachmentsModel();

// const ActivitiesModel = require("../models/ActivitiesModel");
// const activitiesModel = new ActivitiesModel();


export async function phaseFormat(phase, tickets, props){
  
  phase.sla && await tickets.map(ticket => props.slaController.ticketSLA(phase.id,ticket.id)) 

  await tickets.map(ticket =>  (ticket.responsible = props.ticketModel.getLastResponsibleTicket(ticket.id)) && (ticket.updated_at = moment(ticket.updated_at).format("DD/MM/YYYY HH:mm:ss")))
  
  return tickets
}

export async function formatTicketForPhase(phase, ticket,props) {
  
  phase.sla && (ticket.sla = await props.slaController.ticketSLA(phase.id, ticket.id))

  // ticket.created_at = moment(ticket.created_at).format("DD/MM/YYYY HH:mm:ss");
  ticket.updated_at = moment(ticket.updated_at).format("DD/MM/YYYY HH:mm:ss");
  ticket.responsible = await props.ticketModel.getLastResponsibleTicket(ticket.id);
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
      await formatTicketForPhase(phase, ticket, props);
    }
    
    await redis.set(
      `msTicket:header:${authorization}:closeTickets:${phase.id}`,
      JSON.stringify(tickets)
    );
    return tickets;
  }
}
