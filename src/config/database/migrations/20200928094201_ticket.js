
exports.up = function(knex) {
  return knex.schema.createTable("ticket",table=>{
      table.uuid("id")
      table.uuid("id_company").notNullable()
      table.json("ids_crm")
      table.integer("id_user")
      table.integer("id_customer")
      table.timestamps(true,true)

      table.primary("id")
      table.foreign("id_company").references("company.id")
  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("ticket")
};
