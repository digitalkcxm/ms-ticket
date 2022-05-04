// const knex = require("./src/config/database/database");
// const moment = require("moment");

// const AttachmentsModel = require("./src/models/AttachmentsModel");
// const attachmentsModel = new AttachmentsModel();

// const ActivitiesModel = require("./src/models/ActivitiesModel");
// const activitiesModel = new ActivitiesModel();

// const TicketModel = require("./src/models/TicketModel");
// const ticketModel = new TicketModel();

// async function phases() {
//   const phases = await knex("phase").select(
//     "id",
//     "id_unit_of_time",
//     "sla_time"
//   );

//   // id do tipo "Iicializar ticket"
//   const id_sla_type = 1;
//   if (phases && Array.isArray(phases) && phases.length > 0) {
//     for (const phase of phases) {
//       await knex("phase_sla_settings").insert({
//         id_phase: phase.id,
//         id_sla_type,
//         id_unit_of_time: phase.id_unit_of_time,
//         time: phase.sla_time,
//         active: true,
//       });
//     }
//   }
//   console.log("fim");
// }

// async function tickets() {
//   const id_sla_type = 1;

//   const tickets = await knex("ticket as t")
//     .select(
//       "t.id",
//       "pt.id_phase",
//       "t.created_at",
//       "pss.id_unit_of_time",
//       "pss.time",
//       "t.closed"
//     )
//     .leftJoin("phase_ticket as pt", "pt.id_ticket", "t.id")
//     .leftJoin("phase_sla_settings AS pss", "pss.id_phase", "pt.id_phase")
//     .where("pss.id_sla_type", id_sla_type)
//     .where("pt.active", true);

//   if (tickets && Array.isArray(tickets) && tickets.length > 0) {
//     for (const ticket of tickets) {
//       const active = ticket.closed ? false : true;
//       const count = await knex("ticket_sla_control")
//         .count()
//         .where("id_ticket", ticket.id);

//       // if (!count || !Array.isArray(count)) {
//       if (
//         count &&
//         Array.isArray(count) &&
//         count[0].count
//         // count[0].count <= 0
//       ) {
//         console.log(count);

//         const activities = await knex("activities_ticket")
//           .select("created_at")
//           .where("id_ticket", ticket.id)
//           .orderBy("created_at", "asc")
//           .limit(1);

//         switch (ticket.id_unit_of_time) {
//           case 1:
//             ticket.unit_of_time = "seconds";
//             break;
//           case 2:
//             ticket.unit_of_time = "minutes";
//             break;
//           case 3:
//             ticket.unit_of_time = "hours";
//             break;
//           case 4:
//             ticket.unit_of_time = "days";
//             break;
//           default:
//             break;
//         }
//         ticket.countSLA = moment(ticket.created_at).add(
//           ticket.time,
//           ticket.unit_of_time
//         );
//         if (activities && Array.isArray(activities) && activities.length > 0) {
//           if (ticket.countSLA < activities[0].created_at) {
//             //Atrasado
//             await knex("ticket_sla_control").insert({
//               id_ticket: ticket.id,
//               id_phase: ticket.id_phase,
//               id_sla_type,
//               id_sla_status: 2,
//               limit_sla_time: ticket.countSLA,
//               interaction_time: activities[0].created_at,
//               active: false,
//             });
//           } else if (ticket.countSLA > activities[0].created_at) {
//             //Em dia
//             await knex("ticket_sla_control").insert({
//               id_ticket: ticket.id,
//               id_phase: ticket.id_phase,
//               id_sla_type,
//               id_sla_status: 1,
//               limit_sla_time: ticket.countSLA,
//               interaction_time: activities[0].created_at,
//               active: false,
//             });
//           }
//         } else {
//           if (ticket.countSLA < moment()) {
//             //Atrasado
//             await knex("ticket_sla_control").insert({
//               id_ticket: ticket.id,
//               id_phase: ticket.id_phase,
//               id_sla_type,
//               id_sla_status: 2,
//               limit_sla_time: ticket.countSLA,
//               active: active,
//             });
//           } else if (ticket.countSLA > moment()) {
//             //Em dia
//             await knex("ticket_sla_control").insert({
//               id_ticket: ticket.id,
//               id_phase: ticket.id_phase,
//               id_sla_type,
//               id_sla_status: 1,
//               limit_sla_time: ticket.countSLA,
//               active: active,
//             });
//           }
//         }
//       }
//     }
//     console.log("fim");
//   }
// }

// async function _activities(id_ticket, id_company) {
//   const obj = [];

//   const activities = await activitiesModel.getActivities(id_ticket);
//   activities.map((value) => {
//     value.type = "note";
//     obj.push(value);
//   });

//   const attachments = await attachmentsModel.getAttachments(id_ticket);
//   attachments.map((value) => {
//     value.type = "file";
//     obj.push(value);
//   });

//   let history_phase = await ticketModel.getHistoryTicket(id_ticket);
//   for (let index in history_phase) {
//     index = parseInt(index);

//     if (history_phase[index + 1]) {
//       if (history_phase[index].id_phase != history_phase[index + 1].id_phase) {
//         obj.push({
//           type: "move",
//           id_user: history_phase[index + 1].id_user,
//           phase_dest: {
//             id: history_phase[index].id_phase,
//             name: history_phase[index].name,
//           },
//           phase_origin: {
//             id: history_phase[index + 1].id_phase,
//             name: history_phase[index + 1].name,
//           },
//           created_at: history_phase[index + 1].created_at,
//         });
//       }
//     }
//   }

//   const view_ticket = await ticketModel.getViewTicket(id_ticket);
//   view_ticket.map((value) => {
//     value.end ? (value.end = value.end) : "";
//     value.created_at = value.start;
//     value.type = "view";
//     obj.push(value);
//   });

//   const create_protocol = await ticketModel.getProtocolCreatedByTicket(
//     id_ticket,
//     id_company
//   );
//   create_protocol.map((value) => {
//     value.type = "create_protocol";
//     obj.push(value);
//   });

//   const create_ticket = await ticketModel.getTicketCreatedByTicketFather(
//     id_ticket,
//     id_company
//   );
//   create_ticket.map((value) => {
//     value.type = "create_ticket";
//     obj.push(value);
//   });
//   return obj;
// }

// // script para atualizar o status do ticket
// async function update_status_ticket() {
//   try {
//     const tickets = await knex("ticket").select(
//       "ticket.id",
//       "ticket.closed",
//       "ticket.start_ticket",
//       "ticket.id_company"
//     );

//     if (tickets && tickets.length > 0) {
//       for (const ticket of tickets) {
//         if (ticket.closed) {
//           console.log(1);
//           await knex("ticket").update({ id_status: 3 }).where("id", ticket.id);
//         } else if (ticket.start_ticket) {
//           console.log(2);
//           await knex("ticket").update({ id_status: 2 }).where("id", ticket.id);
//         } else {
//           const activities = await _activities(ticket.id, ticket.id_company);
//           const result = await new Promise((resolve) => {
//             resolve(
//               activities.sort((a, b) => {
//                 if (a.created_at === b.created_at) {
//                   return a.id;
//                 } else {
//                   return a.created_at - b.created_at;
//                 }
//               })
//             );
//           });

//           if (result && result.length > 0) {
//             console.log(3, result[0].created_at);
//             await knex("ticket")
//               .update({
//                 id_status: 2,
//                 start_ticket: result[0].created_at,
//               })
//               .where("id", ticket.id);
//           }
//         }
//       }
//     }
//     console.log("fim");
//   } catch (err) {
//     console.log("ERRO =>", err);
//   }
// }
// //update_status_ticket();
// // phases();
// // tickets();

// async function update_status_sla_ticket() {
//   const SLAModel = require("./src/models/SLAModel");
//   const slaModel = new SLAModel();
//   const tickets = await knex("ticket_sla_control").where("id_sla_status", 1);
//   console.log(tickets.length);
//   for (const ticket of tickets) {
//     switch (ticket.id_sla_type) {
//       case 1:
//         if (!ticket.interaction_time && ticket.limit_sla_time < moment()) {
//           console.log(1);
//           await slaModel.updateTicketSLA(
//             ticket.id_ticket,
//             { id_sla_status: 2 },
//             ticket.id_sla_type,
//             ticket.id_phase
//           );
//         }

//         break;
//       case 2:
//         if (
//           ticket.interaction_time < ticket.limit_sla_time &&
//           ticket.limit_sla_time < moment()
//         ) {
//           console.log(2);
//           await slaModel.updateTicketSLA(
//             ticket.id_ticket,
//             { id_sla_status: 2 },
//             ticket.id_sla_type,
//             ticket.id_phase
//           );
//         }

//         break;
//       case 3:
//         if (ticket.limit_sla_time < moment()) {
//           console.log(2);
//           await slaModel.updateTicketSLA(
//             ticket.id_ticket,
//             { id_sla_status: 2 },
//             ticket.id_sla_type,
//             ticket.id_phase
//           );
//         }

//         break;
//       default:
//         break;
//     }
//   }
//   console.log("fim");
// }

// // update_status_sla_ticket();

// async function update_customer() {
//   const customers = await knex("customer").select();
//   for (const customer of customers) {
//     console.log("===>", customer);
//     if (customer.name) {
//       await knex("ticket").update({ display_name: customer.name }).where("id", customer.id_ticket);
//     } else if (customer.phone) {
//       await knex("ticket").update({ display_name: customer.phone }).where("id", customer.id_ticket);
//     } else if (customer.email) {
//       await knex("ticket").update({ display_name: customer.email }).where("id", customer.id_ticket);
//     }
//   }
// }

// update_customer();


const array = ["text","123",123]

for(const x of array){
 
  console.log(!parseInt(x) )
}