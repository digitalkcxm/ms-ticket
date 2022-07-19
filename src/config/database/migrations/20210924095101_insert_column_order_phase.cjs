
exports.up = function (knex, Promise) {
    return knex.schema.alterTable('phase', (table) => {
        table.integer('order')
    })
}

exports.down = function (knex, Promise) {
    return knex.schema.alterTable('phase', (table) => {
        table.dropColumn('order')
    })
}
