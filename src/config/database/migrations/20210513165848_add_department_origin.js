
exports.up = function(knex) {
    return knex.schema.alterTable('ticket', (table) => {
        table.integer('department_origin')

        table.foreign("department_origin").references("deparment.id")
    })
};

exports.down = function(knex) {
    return knex.schema.alterTable('ticket', (table) => {
        table.dropColumn('department_origin')
    })
};
