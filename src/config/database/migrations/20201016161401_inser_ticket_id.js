
exports.up = function (knex) {
    return knex.schema.alterTable("ticket", (table) => {
        table.increments("id_ticket")
    })
};

exports.down = function (knex) {
    return knex.schema.alterTable("ticket", (table) => {
        table.dropColumn("id_ticket")
    })
};
