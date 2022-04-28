
exports.up = function(knex) {
  return knex.schema.alterTable("users",(table)=>{
      table.string("name")
  })
};

exports.down = function(knex) {
  return knex.schema.alterTable("users",(table)=>{
      table.dropColumn("name")
  })
};
