
exports.up = function (knex) {
  return knex.schema.createTable("notify_phase", table => {
    table.increments()
    table.uuid("id_phase")
    table.integer("id_user")
    table.integer("id_email")

    table.foreign("id_phase").references("phase.id")
    table.foreign("id_user").references("users.id")
    table.foreign("id_email").references("email.id")
  })
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("notify_phase")
};
