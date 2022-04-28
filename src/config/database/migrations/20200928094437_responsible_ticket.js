
exports.up = function(knex) {
  return knex.schema.createTable("responsible_ticket",table=>{
      table.increments()
      table.uuid("id_ticket").notNullable()
      table.integer("id_user")
      table.integer("id_email")
      table.integer("id_type_of_responsible").notNullable()

      table.foreign("id_ticket").references("ticket.id")
      table.foreign("id_user").references("users.id")
      table.foreign("id_email").references("email.id")
      table.foreign("id_type_of_responsible").references("type_of_responsible.id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("responsible_ticket")
};
