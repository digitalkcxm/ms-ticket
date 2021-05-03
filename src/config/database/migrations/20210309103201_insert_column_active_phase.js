exports.up = function (knex) {
    return knex.schema.alterTable("phase", table => {
        table.boolean("active").default(true)
    })
}

exports.down = function (knex) {
    return knex.schema.alterTable("phase", table => {
        table.dropColumn("active")
    })
}