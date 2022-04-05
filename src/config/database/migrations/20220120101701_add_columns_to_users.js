exports.up = function (knex, Promise) {
    return knex.schema.alterTable("users", (table) => {
      table.string("phone");
      table.string("email");
      table.integer("id_type");
  
      table.foreign("id_type").references("type_user.id");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("users", (table) => {
      table.dropColumn("time_closed_ticket");
      table.dropColumn("id_type");
    });
  };
  