
exports.up = function (knex, Promise) {
    return knex.schema.alterTable('activities_ticket', (table) => {
        table.integer('id_chat')

        table.foreign("id_chat").references("ticket_email_id.id")
    })
}

exports.down = function (knex, Promise) {
    return knex.schema.alterTable('activities_ticket', (table) => {
        table.dropColumn('id_chat')
    })
}
