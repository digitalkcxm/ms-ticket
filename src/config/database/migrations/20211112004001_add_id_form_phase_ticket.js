
exports.up = function (knex, Promise) {
    return knex.schema.alterTable('phase_ticket', (table) => {
        table.string('id_form')
    })
}

exports.down = function (knex, Promise) {
    return knex.schema.alterTable('phase', (table) => {
        table.dropColumn('id_form')
    })
}
