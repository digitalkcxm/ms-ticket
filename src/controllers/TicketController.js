const TicketModel = require("../models/TicketModel")
const UserController = require("./UserController")
const PhaseModel = require("../models/PhaseModel")
const EmailController = require("./EmailController")
const UserModel = require("../models/UserModel")

const moment = require("moment")
const { v1 } = require("uuid")
const notify = require("../helpers/Notify")

const ticketModel = new TicketModel()
const userController = new UserController()
const phaseModel = new PhaseModel()
const emailController = new EmailController()
const userModel = new UserModel()
class TicketController {
    async create(req, res) {
        try {
            let userResponsible = []
            let emailResponsible = []
            if (!req.body.id_user)
                return res.status(400).send({ error: "Whitout id_user, please inform your user_id " })

            let id_user = await userController.checkUserCreated(req.body.id_user, req.headers.authorization)
            if (!id_user || !id_user.id)
                return res.status(400).send({ error: "Error when get user by id" })

            if (!req.body.id_phase)
                return res.status(400).send({ error: "Whitout id_phase, please inform  id_phase" })

            if (!req.body.responsible || req.body.responsible.length <= 0)
                return res.status(400).send({ error: "Please inform ticket responsible" })

            req.body.responsible.map(async responsible => {
                let result
                if (responsible.id) {
                    result = await userController.checkUserCreated(responsible.id, req.headers.authorization)
                    userResponsible.push(result.id)
                } else if (responsible.email) {
                    result = await emailController.checkEmailCreated(responsible.email, req.headers.authorization)
                    emailResponsible.push(result.id)
                }
            })

            let obj = {
                id: v1(),
                id_company: req.headers.authorization,
                ids_crm: req.body.ids_crm,
                id_customer: req.body.id_customer,
                id_user: id_user.id,
                created_at: moment().format(),
                updated_at: moment().format()
            }

            let result = await ticketModel.create(obj)

            await this._createResponsibles(userResponsible, emailResponsible, obj.id)

            let phase = await phaseModel.getPhase(req.body.id_phase, req.headers.authorization)

            if (!phase || phase.length <= 0)
                return res.status(400).send({ error: "Invalid id_phase uuid" })

            let phase_id = await ticketModel.createPhaseTicket({
                "id_phase": phase[0].id,
                "id_ticket": obj.id
            })

            if (!phase_id || phase.length <= 0)
                return res.status(500).send({ error: "There was an error" })

            await this._notifyResponsiblesPhase(phase[0].id, req.company[0].notify_token, obj.id, userResponsible, emailResponsible, req.headers.authorization)

            if (result && result.length > 0 && result[0].id)
                return res.status(200).send(obj)

            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error when generate object to save ticket => ", err)
            return res.status(400).send({ error: "Error when generate object to save ticket" })
        }
    }

    async _createResponsibles(userResponsible = null, emailResponsible = null, ticket_id) {
        try {

            if (userResponsible.length > 0) {
                userResponsible.map(async user => {
                    await ticketModel.createResponsibleTicket({
                        "id_ticket": ticket_id,
                        "id_user": user,
                        "id_type_of_responsible": 2
                    })
                })
            }
            if (emailResponsible.length > 0) {
                emailResponsible.map(async email => {
                    await ticketModel.createResponsibleTicket({
                        "id_ticket": ticket_id,
                        "id_email": email,
                        "id_type_of_responsible": 2
                    })
                })
            }

            return true
        } catch (err) {
            console.log("Error when create responsibles ==> ", err)
            return false
        }
    }

    async _notifyResponsiblesPhase(phase_id, notify_token, ticket_id, userResponsibleTicket, emailResponsibleTicket, id_company) {
        try {
            let responsiblePhase = await phaseModel.getResponsiblePhase(phase_id)
            let notifyPhase = await phaseModel.getNotifiedPhase(phase_id)

            if (responsiblePhase && responsiblePhase.length > 0) {
                responsiblePhase.map(async contact => {
                    if (contact.user_id) {
                        await notify(notify_token, {
                            "id_user": contact.id_user_core,
                            "type": 4,
                            "id_ticket": ticket_id,
                            "id_phase": phase_id
                        })
                    } else if (contact.email) {
                        console.log("teste")
                    }
                })
            }

            if (notifyPhase && notifyPhase.length > 0) {
                notifyPhase.map(async contact => {
                    if (contact.user_id) {
                        await notify(notify_token, {
                            "id_user": contact.id_user_core,
                            "type": 4,
                            "id_ticket": ticket_id,
                            "id_phase": phase_id
                        })
                    } else if (contact.email) {
                        console.log("Teste Notify")
                    }
                })
            }

            for (let i = 0; i < userResponsibleTicket.length; i++) {
                await responsiblePhase.map(userPhase => {
                    if (userPhase.id_user == userResponsibleTicket[i])
                        delete userResponsibleTicket[i]

                })
                if (userResponsibleTicket[i]) {
                    await notifyPhase.map(userPhase => {
                        if (userPhase.id_user == userResponsibleTicket[i] > 0)
                            delete userResponsibleTicket[i]
                    })
                }
                if (userResponsibleTicket[i]) {
                    let infoUser = await userModel.getById(userResponsibleTicket[i], id_company)
                    console.log("TicketController -> _notifyResponsiblesPhase -> infoUser", infoUser)
                    await notify(notify_token, {
                        "id_user": infoUser[0].id_user_core,
                        "type": 4,
                        "id_ticket": ticket_id,
                        "id_phase": phase_id
                    })
                }
            }
            for (let i = 0; i < emailResponsibleTicket.length; i++) {
                await responsiblePhase.map(userPhase => {
                    if (userPhase.id_user == emailResponsibleTicket[i])
                        delete emailResponsibleTicket[i]

                })
                if (emailResponsibleTicket[i]) {
                    await notifyPhase.map(userPhase => {
                        if (userPhase.id_user == emailResponsibleTicket[i] > 0)
                            delete emailResponsibleTicket[i]
                    })
                }
                if (emailResponsibleTicket[i]) {
                    let infoUser = await emailModel.getEmailById(emailResponsibleTicket[i], id_company)
                    console.log("SEND EMAIL")
                }
            }
            return true
        } catch (err) {
            console.log("Error when notify responsibles ==> ", err)
            return false
        }
    }

    async createActivities(req, res) {
        try {
            if (!req.body.id_user)
                return res.status(400).send({ error: "Whitout id_user" })

            let user = await userController.checkUserCreated(req.body.id_user, req.headers.authorization)

            if (!user || !user.id)
                return res.status(400).send({ error: "There was an error" })

            let ticket = await ticketModel.getTicketById(req.body.id_ticket, req.headers.authorization)
            if (!ticket || ticket.length <= 0)
                return res.status(400).send({ error: "ID ticket is invalid" })

            let obj = {
                "text": req.body.text,
                "id_ticket": req.body.id_ticket,
                "id_user": user.id,
                "created_at": moment().format(),
                "updated_at": moment().format()
            }

            let result = await ticketModel.createActivitiesTicket(obj)
            console.log("TicketController -> createActivities -> result", result)

            if (result && result.length > 0) {
                obj.id = result[0].id
                return res.status(200).send(obj)
            }

            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error manage object to create activities => ", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async createAttachments(req, res) {
        try {
            if (!req.body.id_user)
                return res.status(400).send({ error: "Whitout id_user" })

            let user = await userController.checkUserCreated(req.body.id_user, req.headers.authorization)

            if (!user || !user.id)
                return res.status(400).send({ error: "There was an error" })

            let ticket = await ticketModel.getTicketById(req.body.id_ticket, req.headers.authorization)
            if (!ticket || ticket.length <= 0)
                return res.status(400).send({ error: "ID ticket is invalid" })

            let typeAttachments = await ticketModel.getTypeAttachments(req.body.type)

            if (!typeAttachments || typeAttachments.length <= 0)
                return res.status(400).send({ error: "Type attachments is invalid" })

            let obj = {
                "id_user": user.id,
                "id_ticket": req.body.id_ticket,
                "url": req.body.url,
                "type": req.body.type,
                "created_at": moment().format(),
                "updated_at": moment().format()
            }

            let result = await ticketModel.createAttachmentsTicket(obj)

            if (result && result.length > 0) {
                obj.id = result[0].id
                return res.status(200).send(obj)
            }

            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error manage object to create attachments => ", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async getTicketByID(req, res) {
        try {
            const result = await ticketModel.getTicketById(req.params.id, req.headers.authorization)
            if (result.name && result.name == 'error')
                return res.status(400).send({ error: "There was an error" })

            if (result && result.length > 0)
                return res.status(200).send(result)

            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error when select ticket by id =>", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async getAllTicket(req, res) {
        try {
            const result = await ticketModel.getAllTickets(req.headers.authorization)
            if (result.name && result.name == 'error')
                return res.status(400).send({ error: "There was an error" })

            if (result && result.length > 0)
                return res.status(200).send(result)

            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error when select ticket by id =>", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }
}

module.exports = TicketController