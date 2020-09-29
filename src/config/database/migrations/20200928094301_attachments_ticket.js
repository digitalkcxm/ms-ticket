
exports.up = function (knex) {
    return knex.schema.createTable("attachments_ticket", table => {
        table.increments()
        table.string("url").notNullable()
        table.integer("type").notNullable()
        table.uuid("id_ticket").notNullable()
        table.timestamps(true,true)

        table.foreign("id_ticket").references("ticket.id")
        table.foreign("type").references("type_attachments.id")
    })
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("attachments_ticket")
};
