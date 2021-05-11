
exports.up = function (knex, Promise) {
    return knex.schema.alterTable('phase_ticket', (table) => {
        table.integer('id_user')

        table.foreign("id_user").references("users.id")
    })
}

exports.down = function (knex, Promise) {
    return knex.schema.alterTable('phase_ticket', (table) => {
        table.dropColumn('id_user')
    })
}
