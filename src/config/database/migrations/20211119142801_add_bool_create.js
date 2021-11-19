exports.up = function (knex, Promise) {
    return knex.schema.alterTable("phase", (table) => {
      table.boolean("create_ticket");
      table.boolean("create_protocol");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("phase", (table) => {
      table.dropColumn("create_ticket");
      table.dropColumn("create_protocol");
    });
  };
  