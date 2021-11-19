exports.up = function (knex, Promise) {
  return knex.schema.alterTable("ticket_protocol", (table) => {
    table.integer("id_user");
    table.boolean("created_by_ticket").default(false);

    table.foreign("id_user").references("users.id");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("ticket_protocol", (table) => {
    table.dropColumn("id_user");
    table.dropColumn("created_by_ticket");
  });
};
