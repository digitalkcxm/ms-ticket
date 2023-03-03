exports.up = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.string("protocol_pattern", 25);
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.dropColumn("protocol_pattern");
    });
  };
  