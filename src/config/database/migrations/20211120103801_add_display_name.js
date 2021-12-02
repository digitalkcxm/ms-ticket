exports.up = function (knex, Promise) {
  return knex.schema.alterTable("ticket", (table) => {
    table.string("display_name");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("ticket", (table) => {
    table.dropColumn("display_name");
  });
};
