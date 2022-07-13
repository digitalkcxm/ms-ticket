exports.up = async function (knex) {
    const type_attachments = ["doc","pdf","txt"]

    return await Promise.all(type_attachments.map(name => knex("type_attachments").insert({ name })))
};

exports.down = function (knex) {

};
