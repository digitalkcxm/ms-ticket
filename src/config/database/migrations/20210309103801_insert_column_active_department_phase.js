exports.up = function (knex) {
    return knex.schema.alterTable("department_phase", table => {
        table.boolean("active").default(true)
    })
}

exports.down = function (knex) {
    return knex.schema.alterTable("department_phase", table => {
        table.dropColumn("active")
    })
}