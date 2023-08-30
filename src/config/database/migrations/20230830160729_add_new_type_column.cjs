exports.up = knex => knex.schema.raw(`INSERT INTO type_column (name) VALUES ('opt_in');`)

exports.down = function (knex) {}