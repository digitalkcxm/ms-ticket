
exports.up = function(knex) {
  return knex.schema.createTable("company",table=>{
      table.uuid("id").notNullable()
      table.string("name").notNullable()
      table.string("callback").notNullable()
      table.boolean("active").default(true)
      table.timestamps(true,true)
      table.unique("id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("company")
};
