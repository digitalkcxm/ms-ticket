exports.up = async function (knex) {
  const type_columns = [
    "cpfcnpj",
    "email",
    "array",
    "options",
    "phone_number",
    "cep",
  ];

  await Promise.all(
    type_columns.map((name) => knex("type_column").insert({ name }))
  );

  await knex("type_column").update({ name: "int" }).where('name', 'Integer');
  await knex("type_column").update({ name: "decimal" }).where('name', 'Float');

};

exports.down = function (knex) {};
