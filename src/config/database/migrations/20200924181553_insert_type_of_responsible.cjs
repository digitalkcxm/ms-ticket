
exports.up = async function(knex) {
  const type_of_responsible = ["phase","ticket"]

  await Promise.all(type_of_responsible.map(name => knex("type_of_responsible").insert({name})))
};

exports.down = function(knex) {
  
};
