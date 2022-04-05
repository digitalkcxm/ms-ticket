
exports.up = function(knex) {
    return knex.schema.createTable("tab", table => {
        table.increments()
        table.uuid("id_ticket").notNullable()
        table.uuid("id_tab").notNullable()
        table.string("description")
        table.timestamps(true, true)
        table.integer('id_user').notNullable()

        table.foreign("id_user").references("users.id")
        table.foreign("id_ticket").references("ticket.id")
      })
};

exports.down = function(knex) {
    return knex.schema.dropTableIfExists("tab")
};
