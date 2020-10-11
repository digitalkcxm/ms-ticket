
exports.up = function (knex) {
    return knex.schema.createTable("type_column", (table) => {
        table.increments()
        table.string("name")
    })
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("type_column")
};
