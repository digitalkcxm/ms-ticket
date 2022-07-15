
exports.up = function(knex) {
  return knex.schema.alterTable("phase",(table)=>{
      table.boolean("form").default(true)
  })
};

exports.down = function(knex) {
    return knex.schema.alterTable("phase",(table)=>{
        table.dropColumn('form')
    })
};
