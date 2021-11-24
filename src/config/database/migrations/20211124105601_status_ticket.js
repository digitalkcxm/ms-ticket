exports.up = async function (knex) {
  await knex.schema.createTable("status_ticket", (table) => {
    table.increments();
    table.string("name");
    table.timestamps(true, true);
  });
  const status = ["Aberto", "Em atendimento", "Finalizado"];
  return await Promise.all(
    status.map((name) => knex("status_ticket").insert({ name }))
  );
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("status_ticket");
};
