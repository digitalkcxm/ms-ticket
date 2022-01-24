exports.up = async function (knex) {
    await knex.schema.createTable("type_user", (table) => {
      table.increments();
      table.string("name");
    });
    const tipos = ["Core", "Landing Page"];
    return await Promise.all(
      tipos.map((name) => knex("type_user").insert({ name }))
    );
  };
  
  exports.down = function (knex) {
    return knex.schema.dropTableIfExists("type_user");
  };
  