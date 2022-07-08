exports.up = async function (knex, Promise) {
  const tickets = await knex("ticket").select(["id", "id_status", "closed"]);
  const status = await knex("status_ticket").select(["id", "name"]);
  return tickets.map(
    async (x) =>
      await knex("ticket").update({
        status: status.find((y) => y.id === x.id_status).name,
      })
  );
};

exports.down = function (knex, Promise) {};
