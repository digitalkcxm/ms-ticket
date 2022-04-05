exports.up = async function (knex){
    return await knex.schema.createTable("ticket_sla_control",table => {
        table.increments()
        table.uuid('id_ticket').notNullable()
        table.uuid('id_phase').notNullable()
        table.integer('id_sla_type').notNullable()
        table.integer('id_sla_status').notNullable()
        table.timestamp("limit_sla_time").notNullable()
        table.timestamp("interaction_time")
        table.boolean("active").default(true)

        table.foreign("id_ticket").references('ticket.id')
        table.foreign('id_phase').references('phase.id')
        table.foreign('id_sla_type').references('sla_type.id')
        table.foreign('id_sla_status').references('sla_status.id')
    })
}


exports.down = function (knex){}