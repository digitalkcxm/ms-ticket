
exports.up = function (knex) {
    return knex.schema.createTable("ticket_email_id", (table => {
        table.increments()
        table.uuid("id_ticket").notNullable()
        table.string("chat_id").notNullable()

        table.foreign("id_ticket").references("ticket.id")

    }))
};

exports.down = function (knex) {

};
