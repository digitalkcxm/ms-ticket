exports.up = async function (knex) {
    const tipos = ["Smartflow"];
    return await Promise.all(
      tipos.map((name) => knex("type_user").insert({ name }))
    );
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTableIfExists("type_user");
  };
  