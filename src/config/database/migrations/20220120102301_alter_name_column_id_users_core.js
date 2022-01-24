exports.up = async function (knex) {
    return await knex.raw(`
    alter table users rename column id_users_core to id_users 
        `);

  };
  
  exports.down = function (knex) {};
  