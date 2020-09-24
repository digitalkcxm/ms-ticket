
exports.up = function (knex) {
    return knex.schema.createTable("unit_of_time", table => {
        table.increments()
        table.string("nome").notNullable()
    })
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("unit_of_time")
};
