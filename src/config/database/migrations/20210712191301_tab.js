
exports.up = function(knex) {
    return knex.schema.createTable("tab", table => {
        table.increments()
        table.uuid("id_phase").notNullable()
        table.uuid("id_ticket").notNullable()
        table.string("id_form")
        table.uuid("id_tab").notNullable()
        table.string("description")
        table.timestamps(true, true)
    
        table.foreign("id_phase").references("phase.id")
        table.foreign("id_ticket").references("ticket.id")
      })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists("tab")
};
