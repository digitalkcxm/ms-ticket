exports.up = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.uuid("id_phase");
      table.string("phase");
      table.string("status");
      
  
      table.foreign("id_phase").references("phase.id");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.dropColumn("id_phase");
      table.dropColumn("phase");
      table.dropColumn("status");
    });
  };
  