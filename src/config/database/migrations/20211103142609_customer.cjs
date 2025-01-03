exports.up = function (knex) {
    return knex.schema.createTable("customer", (table) => {
        table.increments()
        table.integer("id_core")
        table.uuid("id_ticket").notNullable()
        table.string("name")
        table.string("phone")
        table.string("email")
        table.string('identification_document')
        table.json('crm_ids')
        table.string('crm_contact_id')
        table.timestamps(true, true)

        table.foreign("id_ticket").references("ticket.id")
    })
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("customer")
};