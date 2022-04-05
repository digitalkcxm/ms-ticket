
exports.up = async function(knex) {
  const unit_of_time = ["Segundo","Minuto","Hora","Dia"]

  await Promise.all(unit_of_time.map(name => knex('unit_of_time').insert({name})))
};

exports.down = function(knex) {
  
};
