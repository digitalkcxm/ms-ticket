
exports.up = function(knex) {
  return knex.schema.createTable("notify_phase",table=>{
      table.increments()
      table.uuid("id_phase")
      table.integer("id_user")

      table.foreign("id_phase").references("phase.id")
      table.foreign("id_user").references("users.id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("notify_phase")
};
