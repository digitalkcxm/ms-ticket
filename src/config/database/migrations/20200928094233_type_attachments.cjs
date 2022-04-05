
exports.up = function (knex) {
    return knex.schema.createTable("type_attachments",table =>{
        table.increments()
        table.string("name").notNullable()
    }) 
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("type_attachments")
};
