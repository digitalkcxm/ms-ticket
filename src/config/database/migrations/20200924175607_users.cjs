
exports.up = function(knex) {
  return knex.schema.createTable("users",table=>{
      table.increments()
      table.uuid("id_company").notNullable()
      table.integer("id_users_core").notNullable()
      table.timestamps(true,true)

      table.foreign("id_company").references("company.id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("users")
};
