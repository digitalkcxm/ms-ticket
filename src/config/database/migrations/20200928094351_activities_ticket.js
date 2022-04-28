
exports.up = function(knex) {
  return knex.schema.createTable("activities_ticket",table => {
      table.increments()
      table.string("text").notNullable()
      table.uuid("id_ticket").notNullable()
      table.integer("id_user").notNullable()
      table.timestamps(true,true)

      table.foreign("id_ticket").references("ticket.id")   
      table.foreign("id_user").references("users.id")   
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("activities_ticket")
};
