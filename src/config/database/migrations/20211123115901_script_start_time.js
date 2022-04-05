exports.up = async function (knex) {
  const tickets = await knex.raw(`
      select 
          id
      from ticket
      where start_ticket is null
      `);
  for await (const ticket of tickets.rows) {
    const first_interaction = await knex("activities_ticket")
      .select("created_at")
      .where("id_ticket", ticket.id)
      .orderBy("created_at", "asc")
      .limit(1);

          if (
      first_interaction &&
      first_interaction.length > 0 &&
      first_interaction[0].created_at
    ) {
        
      await knex("ticket")
        .update({
          start_ticket: first_interaction[0].created_at,
        })
        .where("id", ticket.id);
    }
  }
};

exports.down = function (knex) {};
