exports.up = function (knex, Promise) {
  return knex.schema.alterTable("phase", (table) => {
    table.json("department_can_create_protocol");
    table.json("department_can_create_ticket");
  });
};

exports.down = function (knex, Promise) {
  return knex.schema.alterTable("phase", (table) => {
    table.dropColumn("department_can_create_protocol");
    table.dropColumn("department_can_create_ticket");
  });
};
