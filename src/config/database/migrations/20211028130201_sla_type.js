exports.up = async function (knex){
    await knex.schema.createTable("sla_type", table =>{
        table.increments()
        table.string("name").notNullable()
    })

    const sla_type = ["Inicializar Ticket","Responder Ticket", "Finalizar/Mover Ticket"]
    return await Promise.all(sla_type.map(name => knex('sla_type').insert({name})))
}

exports.down = function(knex){}