
exports.up = function (knex) {
    return knex.schema.createTable("unit_of_time", table => {
        table.increments()
        table.string("name").notNullable()
    })
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("unit_of_time")
};
