exports.up = async function (knex) {
  return await knex("type_column").insert({ name: "document" });
};

exports.down = function (knex) {};
