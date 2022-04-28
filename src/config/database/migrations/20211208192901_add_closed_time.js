exports.up = function (knex, Promise) {
  return knex.schema.alterTable("ticket", (table) => {
    table.timestamp("time_closed_ticket");
    table.integer("user_closed_ticket");

    table.foreign("user_closed_ticket").references("users.id");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("ticket", (table) => {
    table.dropColumn("time_closed_ticket");
    table.dropColumn("user_closed_ticket");
  });
};
