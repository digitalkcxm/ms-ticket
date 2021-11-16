exports.up = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.uuid("id_ticket_father");
      table.boolean("created_by_ticket").default(false);
      table.boolean("created_by_protocol").default(false);

      table.foreign("id_ticket_father").references("ticket.id");
    });
  };
  
  exports.down = function (knex, Promise) {
    return knex.schema.alterTable("ticket", (table) => {
      table.dropColumn("id_ticket_father");
      table.dropColumn("created_by_ticket");
      table.dropColumn("created_by_protocol");
    });
  };
  