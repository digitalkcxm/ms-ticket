exports.up = function (knex, Promise) {
  return knex.schema.alterTable("responsible_ticket", (table) => {
    table.timestamp("start_ticket");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("responsible_ticket", (table) => {
    table.dropColumn("start_ticket");
  });
};
