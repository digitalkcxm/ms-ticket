
exports.up = function(knex) {
  return knex.schema.createTable("email",table=>{
      table.increments()
      table.uuid("id_company").notNullable()
      table.string("email").notNullable()
      table.timestamps(true,true)

      table.foreign("id_company").references("company.id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("email")
};
