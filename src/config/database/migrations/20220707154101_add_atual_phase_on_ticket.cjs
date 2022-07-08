exports.up = async function (knex, Promise) {
  const tickets = await knex("ticket").select(["id"]);

  return tickets.map(async (x) => {
    const phase_ticket = await knex("phase_ticket")
      .select(["phase.id", "phase.name"])
      .leftJoin("phase", "phase.id", "phase_ticket.id_phase")
      .where("phase_ticket.id_ticket", x.id)
      .andWhere("phase_ticket.active", true);

      
    return await knex("ticket").update({
        id_phase: phase_ticket[0].id,
        phase: phase_ticket[0].name,
      }).where("id", x.id)

  });
};

exports.down = function (knex, Promise) {};
