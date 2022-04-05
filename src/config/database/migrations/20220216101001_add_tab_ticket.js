exports.up = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.string("id_tab");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.dropColumn("id_tab");
      
    });
  };
  