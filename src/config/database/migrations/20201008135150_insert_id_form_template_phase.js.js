
exports.up = function (knex) {
    return knex.schema.alterTable("phase", (table) => {
        table.string("id_form_template")
    })
};

exports.down = function (knex) {
    return knex.schema.alterTable("phase", (table) => {
        table.dropColumn("id_form_template")
    })
};
