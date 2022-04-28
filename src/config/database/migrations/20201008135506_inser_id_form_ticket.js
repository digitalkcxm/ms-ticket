
exports.up = function (knex) {
    return knex.schema.alterTable("ticket", (table) => {
        table.string("id_form")
    })
};

exports.down = function (knex) {
    return knex.schema.alterTable("ticket", (table) => {
        table.dropColumn("id_form")
    })
};
