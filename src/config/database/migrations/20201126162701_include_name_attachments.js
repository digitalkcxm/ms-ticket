
exports.up = function(knex) {
    return knex.schema.alterTable("attachments_ticket",(table)=>{
        table.string("name")
    })
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable("attachments_ticket",(table)=>{
        table.dropColumn("name")
    })
  };
  