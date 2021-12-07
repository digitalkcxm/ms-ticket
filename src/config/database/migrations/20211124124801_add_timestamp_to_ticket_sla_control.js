exports.up = function (knex, Promise) {
  return knex.schema.alterTable("ticket_sla_control", (table) => {
    table.timestamps(true, true);
  });
};

exports.down = function (knex, Promise) {};
