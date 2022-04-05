
exports.up = function (knex) {
    return knex.schema.createTable("ticket_email_id", (table => {
        table.increments()
        table.uuid("id_ticket").notNullable()
        table.string("chat_id").notNullable()
        table.integer("id_email").notNullable()

        table.foreign("id_ticket").references("ticket.id")
        table.foreign("id_email").references("email.id")
    }))
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("ticke_email_id")
};
