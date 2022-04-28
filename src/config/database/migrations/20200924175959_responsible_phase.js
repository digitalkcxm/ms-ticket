
exports.up = function(knex) {
  return knex.schema.createTable("responsible_phase",table=>{
      table.increments()
      table.uuid("id_phase").notNullable()
      table.integer("id_user")
      table.integer("id_email")
      table.integer("id_type_of_responsible")

      table.foreign("id_phase").references("phase.id")
      table.foreign("id_user").references("users.id")
      table.foreign("id_email").references("email.id")
      table.foreign("id_type_of_responsible").references("type_of_responsible.id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("responsible_phase")
};
