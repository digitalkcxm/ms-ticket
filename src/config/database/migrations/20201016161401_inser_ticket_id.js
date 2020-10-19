
exports.up = function (knex) {
    let createQuery = `    ALTER TABLE ticket ADD COLUMN id_seq serial;`
    return knex.raw(createQuery)

    // return knex.schema.alterTable("ticket", (table) => {
    //     table.increments("id_ticket")
    // })
};

exports.down = function (knex) {
    return knex.schema.alterTable("ticket", (table) => {
        table.dropColumn("id_seq")
    })
};
