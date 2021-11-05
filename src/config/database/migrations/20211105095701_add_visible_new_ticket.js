
exports.up = function (knex, Promise) {
    return knex.schema.alterTable('phase', (table) => {
        table.boolean('visible_new_ticket')
    })
}

exports.down = function (knex, Promise) {
    return knex.schema.alterTable('phase', (table) => {
        table.dropColumn('visible_new_ticket')
    })
}
