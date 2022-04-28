exports.up = function (knex, Promise) {
    return knex.schema.alterTable("phase", (table) => {
      table.json("notification_responsible");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("phase", (table) => {
      table.dropColumn("notification_responsible");
    });
  };
  