
exports.up = function(knex) {
  return knex.schema.createTable("phase", table => {
      table.uuid("id")
      table.uuid("id_company").notNullable()
      table.integer("id_unit_of_time")
      table.string("icon")
      table.string("name").notNullable()
      table.integer("sla_time")
      table.boolean("responsible_notify_sla").default(false)
      table.boolean("supervisor_notify_sla").default(false)
      table.timestamps(true,true)

      table.primary("id")
      table.foreign("id_company").references("company.id")
      table.foreign("id_unit_of_time").references("unit_of_time.id")

  })
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists("phase")
};
