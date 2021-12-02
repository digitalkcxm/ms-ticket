exports.up = async function (knex){ 
    await knex.schema.createTable("sla_status", table => {
        table.increments()
        table.string("name").notNullable()
    })

    const sla_status = ["Em dia", "Atrasado", "Aberto"]
    return await Promise.all(sla_status.map(name => knex('sla_status').insert({name})))
}

exports.down = function (knex){}