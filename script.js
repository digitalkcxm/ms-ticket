const knex = require("./src/config/database/database");
const moment = require("moment");
async function phases() {
  const phases = await knex("phase").select(
    "id",
    "id_unit_of_time",
    "sla_time"
  );

  // id do tipo "Iicializar ticket"
  const id_sla_type = 1;
  if (phases && Array.isArray(phases) && phases.length > 0) {
    for (const phase of phases) {
      await knex("phase_sla_settings").insert({
        id_phase: phase.id,
        id_sla_type,
        id_unit_of_time: phase.id_unit_of_time,
        time: phase.sla_time,
        active: true,
      });
    }
  }
}

async function tickets() {
  const id_sla_type = 1;

  const tickets = await knex("ticket as t")
    .select(
      "t.id",
      "pt.id_phase",
      "t.created_at",
      "pss.id_unit_of_time",
      "pss.time"
    )
    .leftJoin("phase_ticket as pt", "pt.id_ticket", "t.id")
    .leftJoin("phase_sla_settings AS pss", "pss.id_phase", "pt.id_phase")
    .where("pss.id_sla_type", id_sla_type)
    .where("pt.active", true);

  if (tickets && Array.isArray(tickets) && tickets.length > 0) {
    for (const ticket of tickets) {
      const count = await knex("ticket_sla_control")
        .count()
        .where("id_ticket", ticket.id);

      // if (!count || !Array.isArray(count)) {
      if (
        count &&
        Array.isArray(count) &&
        count[0].count
        // count[0].count <= 0
      ) {
        console.log(count);

        const activities = await knex("activities_ticket")
          .select("created_at")
          .where("id_ticket", ticket.id)
          .orderBy("created_at", "asc")
          .limit(1);
        switch (ticket.id_unit_of_time) {
          case 1:
            ticket.unit_of_time = "seconds";
            break;
          case 2:
            ticket.unit_of_time = "minutes";
            break;
          case 3:
            ticket.unit_of_time = "hours";
            break;
          case 4:
            ticket.unit_of_time = "days";
            break;
          default:
            break;
        }
        ticket.countSLA = moment(ticket.created_at).add(
          ticket.time,
          ticket.unit_of_time
        );
        if (activities && Array.isArray(activities) && activities.length > 0) {
          if (ticket.countSLA < activities[0].created_at) {
            //Atrasado
            await knex("ticket_sla_control").insert({
              id_ticket: ticket.id,
              id_phase: ticket.id_phase,
              id_sla_type,
              id_sla_status: 2,
              limit_sla_time: ticket.countSLA,
              interaction_time: activities[0].created_at,
              active: false,
            });
          } else if (ticket.countSLA > activities[0].created_at) {
            //Em dia
            await knex("ticket_sla_control").insert({
              id_ticket: ticket.id,
              id_phase: ticket.id_phase,
              id_sla_type,
              id_sla_status: 1,
              limit_sla_time: ticket.countSLA,
              interaction_time: activities[0].created_at,
              active: false,
            });
          }
        } else {
          if (ticket.countSLA < moment()) {
            //Atrasado
            await knex("ticket_sla_control").insert({
              id_ticket: ticket.id,
              id_phase: ticket.id_phase,
              id_sla_type,
              id_sla_status: 2,
              limit_sla_time: ticket.countSLA,
              active: false,
            });
          } else if (ticket.countSLA > moment()) {
            //Em dia
            await knex("ticket_sla_control").insert({
              id_ticket: ticket.id,
              id_phase: ticket.id_phase,
              id_sla_type,
              id_sla_status: 3,
              limit_sla_time: ticket.countSLA,
              active: false,
            });
          }
        }
      }
    }
    console.log("fim");
  }
}
phases();
// tickets();
