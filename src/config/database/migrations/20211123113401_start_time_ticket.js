exports.up = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.timestamp("start_ticket");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.dropColumn("start_ticket");
    });
  };
  