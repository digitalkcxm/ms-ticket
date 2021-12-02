exports.up = function (knex, Promise) {
  return knex.schema.alterTable("ticket", (table) => {
    table.integer("id_status").default(1);

    table.foreign("id_status").references("status_ticket.id");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("ticket", (table) => {
    table.dropColumn("id_status");
  });
};
