
exports.up = function (knex) {
    return knex.schema.createTable("ticket_customer", table => {
      table.increments()
      table.uuid("id_ticket").notNullable()
      table.integer("id_customer").notNullable()
  
      table.foreign("id_ticket").references("ticket.id")
      table.foreign("id_customer").references("customer.id")
    })
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTableIfExists("ticket_customer")
  };