
exports.up = async function (knex) {
    const type_columns = ["String", "Integer", "Boolean", "Date", "Float", "CRM"]

    await Promise.all(type_columns.map(name => knex("type_columns").insert({ name })))
};

exports.down = function (knex) {

};
