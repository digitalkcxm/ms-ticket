exports.up = function (knex) {
  return knex.schema.createTable("ticket_protocol", (table) => {
    table.increments();
    table.uuid("id_ticket").notNullable();
    table.string("id_protocol").notNullable();
    table.uuid("id_company").notNullable();
    table.timestamps(true, true);

    table.foreign("id_ticket").references("ticket.id");
    table.foreign("id_company").references("company.id");
  });
};

exports.down = function (knex) {
    return knex.schema.dropTableIfExists("ticket_protocol")
};