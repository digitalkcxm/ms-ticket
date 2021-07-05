const moment = require("moment")

const TicketModel = require("../models/TicketModel")
const ticketModel = new TicketModel()

const UnitOfTimeModel = require("../models/UnitOfTimeModel")

const FormDocuments = require("../documents/FormDocuments")

const AttachmentsModel = require("../models/AttachmentsModel")
const attachmentsModel = new AttachmentsModel()

const ActivitiesModel = require("../models/ActivitiesModel")
const activitiesModel = new ActivitiesModel()

async function formatTicketForPhase(phase, db, ticket) {
    const typeMoment = await new UnitOfTimeModel().checkUnitOfTime(phase.id_unit_of_time)
    ticket.countSLA = moment(ticket.created_at).add(phase.sla_time, typeMoment)
    ticket.countSLA = moment(ticket.countSLA).format("DD/MM/YYYY HH:mm:ss")
    let first_interaction = await ticketModel.first_interaction(ticket.id)
    first_interaction.length ? ticket.first_message = moment(first_interaction[0].created_at).format("DD/MM/YYYY HH:mm:ss") : ticket.first_message = null

    ticket.count_attachments = await attachmentsModel.getCountAttachments(ticket.id)
    ticket.count_activities = await activitiesModel.getCountActivities(ticket.id)

    if (ticket.id_form) {
        ticket.form_data = await new FormDocuments(db).findRegister(ticket.id_form)
        delete ticket.id_form
    }

    let last_interaction = await ticketModel.last_interaction_ticket(ticket.id)
    if (last_interaction && last_interaction.length) {
        ticket.last_message = last_interaction[0]
        ticket.last_message.created_at = moment(ticket.last_message.created_at).format("DD/MM/YYYY HH:mm:ss")
    }
    ticket.created_at = moment(ticket.created_at).format("DD/MM/YYYY HH:mm:ss")
    ticket.updated_at = moment(ticket.updated_at).format("DD/MM/YYYY HH:mm:ss")
    delete ticket.id_company

    return ticket
}

module.exports = { formatTicketForPhase }