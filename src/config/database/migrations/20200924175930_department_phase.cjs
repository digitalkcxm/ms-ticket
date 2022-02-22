
exports.up = function(knex) {
  return knex.schema.createTable("department_phase",table=>{
      table.increments()
      table.uuid("id_phase")
      table.integer("id_department")

      table.foreign("id_phase").references("phase.id")
      table.foreign("id_department").references("department.id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("department_phase")
};
