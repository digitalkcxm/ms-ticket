
exports.up = async function (knex) {
  const tickets = await knex.raw(`
    select 
        id,
        id_protocol
    from ticket
    where id_protocol is not null
    `);
  for await (const ticket of tickets.rows) {
    await knex("ticket")
      .update({
        created_by_protocol: true,
      })
      .where("id", ticket.id);
  }
};

exports.down = function (knex) {};
