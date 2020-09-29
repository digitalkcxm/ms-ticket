
exports.up = async function (knex) {
    const type_attachments = ["jpeg", "png", "jpg", "peg", "mp4", "ogg", "mp3"]

    return await Promise.all(type_attachments.map(name => knex("type_attachments").insert({ name })))
};

exports.down = function (knex) {

};
