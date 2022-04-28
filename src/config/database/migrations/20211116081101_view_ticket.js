exports.up = function (knex) {
  return knex.schema.createTable("view_ticket", (table) => {
    table.increments();
    table.uuid("id_ticket").notNullable();
    table.timestamp("start");
    table.timestamp("end");
    table.integer("id_user");
    

    table.foreign("id_user").references("users.id");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("view_ticket");
};
