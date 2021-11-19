exports.up = function (knex, Promise) {
    return knex.schema.alterTable("phase", (table) => {
      table.boolean("create_protocol");
      table.boolean("create_protocol");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("phase", (table) => {
      table.dropColumn("create_protocol");
      table.dropColumn("create_protocol");
    });
  };
  