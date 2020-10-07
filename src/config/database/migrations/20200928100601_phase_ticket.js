
exports.up = function (knex) {
    return knex.schema.createTable("phase_ticket", table => {
        table.increments()
        table.uuid("id_phase").notNullable()
        table.uuid("id_ticket").notNullable()
        table.boolean("active").default(true)
        table.foreign("id_phase").references("phase.id")
        table.foreign("id_ticket").references("ticket.id")
    })
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("phase_ticket")
};
