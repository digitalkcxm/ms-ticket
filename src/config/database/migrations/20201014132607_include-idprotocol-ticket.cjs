
exports.up = function(knex) {
  return knex.schema.alterTable("ticket",(table)=>{
      table.string("id_protocol")
  })
};

exports.down = function(knex) {
  return knex.schema.alterTable("ticket",(table)=>{
      table.dropColumn("id_protocol")
  })
};
