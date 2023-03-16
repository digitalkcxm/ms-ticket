exports.up = function (knex, Promise) {
  return knex.schema.alterTable('attachments_ticket', (table) => {
    table.string('text')
    })
}

exports.down = function (knex, Promise) {
  return knex.schema.alterTable('attachments_ticket', (table) => {
    table.dropColumn('text')
  })
}
