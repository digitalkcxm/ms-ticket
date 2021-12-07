const moment = require('moment')
exports.up = async function (knex) {
    const tickets = await knex("ticket").select('id','id_protocol','id_company')
    for await (const ticket of tickets) {
        if(ticket.id_protocol){
            const obj = {
                id_ticket: ticket.id,
                id_protocol: ticket.id_protocol,
                id_company: ticket.id_company,
                created_at: moment().format(),
                updated_at: moment().format(),
            }

            await knex('ticket_protocol').insert(obj)
        }
    }

};

exports.down = function (knex) {};
