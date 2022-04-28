
exports.up = function(knex) {
  return knex.schema.createTable("type_of_responsible",table=>{
      table.increments()
      table.string("name").notNullable()
        
      table.unique("name")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("type_of_responsible")
};
