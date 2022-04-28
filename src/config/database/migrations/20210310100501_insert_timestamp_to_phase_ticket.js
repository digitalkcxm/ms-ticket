exports.up = function (knex) {
    return knex.schema.alterTable("phase_ticket", table => {
        table.timestamps(true, true)
    })
}

exports.down = function (knex) {
    return knex.schema.alterTable("phase_ticket", table => {
        table.dropColumn("created_at")
        table.dropColumn("updated_at")
    })
}