const TicketModel = require("../models/TicketModel")
const UserController = require("./UserController")
const PhaseModel = require("../models/PhaseModel")
const EmailController = require("./EmailController")
const UserModel = require("../models/UserModel")
const CompanyModel = require("../models/CompanyModel")
const EmailService = require("../services/EmailService")
const EmailModel = require("../models/EmailModel")
const FormTemplate = require("../documents/FormTemplate")
const FormDocuments = require("../documents/FormDocuments")
const asyncRedis = require('async-redis')
const redis = asyncRedis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST)

const moment = require("moment")
const { v1 } = require("uuid")
const notify = require("../helpers/Notify")

const ticketModel = new TicketModel()
const userController = new UserController()
const phaseModel = new PhaseModel()
const emailController = new EmailController()
const userModel = new UserModel()
const companyModel = new CompanyModel()
const emailService = new EmailService()
const emailModel = new EmailModel()
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

            let phase = await phaseModel.getPhase(req.body.id_phase, req.headers.authorization)
            console.log("TicketController -> create -> phase", phase)

            if (phase[0].form) {
                let errors = await this._validateForm(req.app.locals.db, phase[0].id_form_template, req.body.form)
                if (errors.length > 0)
                    return res.status(400).send({ errors: errors })

                obj.id_form = await new FormDocuments(req.app.locals.db).createRegister(req.body.form)
            }

            let result = await ticketModel.create(obj, "ticket")

            await this._createResponsibles(userResponsible, emailResponsible, obj.id)


            if (!phase || phase.length <= 0)
                return res.status(400).send({ error: "Invalid id_phase uuid" })

            let phase_id = await ticketModel.create({
                "id_phase": phase[0].id,
                "id_ticket": obj.id
            }, "phase_ticket")



            if (!phase_id || phase.length <= 0)
                return res.status(500).send({ error: "There was an error" })

            await this._notify(phase[0].id, req.company[0].notify_token, obj.id, userResponsible, emailResponsible, req.headers.authorization, 4)


            let ticket = await ticketModel.getTicketById(obj.id, req.headers.authorization)
            console.log("TicketController -> create -> ticket", ticket)
            await redis.set(`msTicket:ticket:${ticket.id}`, JSON.stringify(ticket[0]))

            console.log("TicketController -> create -> result", result)

            if (result && result.length > 0 && result[0].id) {
                delete obj.id_company
                return res.status(200).send(obj)
            }

            console.log("TESTE")
            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error when generate object to save ticket => ", err)
            return res.status(400).send({ error: "Error when generate object to save ticket" })
        }
    }

    async _createResponsibles(userResponsible = null, emailResponsible = null, ticket_id) {
        try {
            await ticketModel.delResponsibleTicket(ticket_id)
            if (userResponsible.length > 0) {
                userResponsible.map(async user => {
                    await ticketModel.create({
                        "id_ticket": ticket_id,
                        "id_user": user,
                        "id_type_of_responsible": 2
                    }, "responsible_ticket")
                })
            }
            if (emailResponsible.length > 0) {
                emailResponsible.map(async email => {
                    await ticketModel.create({
                        "id_ticket": ticket_id,
                        "id_email": email,
                        "id_type_of_responsible": 2
                    }, "responsible_ticket")
                })
            }

            return true
        } catch (err) {
            console.log("Error when create responsibles ==> ", err)
            return false
        }
    }

    async _notify(phase_id, notify_token, ticket_id, userResponsibleTicket, emailResponsibleTicket, id_company, type) {
        try {

            let responsiblePhase = await phaseModel.getResponsiblePhase(phase_id)
            let notifyPhase = await phaseModel.getNotifiedPhase(phase_id)
            switch (type) {
                case 3:
                    const phaseInfo = await phaseModel.getPhase(phase_id, id_company)

                    if (phaseInfo[0] && phaseInfo[0].responsible_notify_sla) {
                        if (responsiblePhase && responsiblePhase.length > 0) {
                            responsiblePhase.map(async contact => {
                                if (contact.user_id) {
                                    await notify(notify_token, {
                                        "id_user": contact.id_user_core,
                                        "type": type,
                                        "id_ticket": ticket_id,
                                        "id_phase": phase_id
                                    })
                                } else if (contact.email) {
                                    await emailService.sendActiveMenssage("SLA de ticket expirado", contact.email, `Um ticket expirou em uma fase de sua responsabilidade\n\nFase: ${contact.phase_description}`)
                                }
                            })
                        }
                    }
                    if (userResponsibleTicket && userResponsibleTicket.length > 0) {
                        await this._notifyUser(type, userResponsibleTicket, id_company, ticket_id, phase_id, notify_token, responsiblePhase, notifyPhase)
                    }

                    if (emailResponsibleTicket && emailResponsibleTicket.length > 0) {
                        for (let i = 0; i < emailResponsibleTicket.length; i++) {
                            await responsiblePhase.map(userPhase => { if (userPhase.id_user == emailResponsibleTicket[i]) { delete emailResponsibleTicket[i] } })

                            if (emailResponsibleTicket[i]) {
                                await notifyPhase.map(userPhase => { if (userPhase.id_user == emailResponsibleTicket[i] > 0) { delete emailResponsibleTicket[i] } })
                            }
                            if (emailResponsibleTicket[i]) {
                                let infoUser = await emailModel.getEmailById(emailResponsibleTicket[i], id_company)
                                await emailService.sendActiveMenssage("Ticket Alert", infoUser[0].email, `Você foi alertado em um dos seus tickets`)
                            }
                        }

                    }
                    break;
                case 4:
                    let email
                    if (responsiblePhase && responsiblePhase.length > 0) {
                        responsiblePhase.map(async contact => {
                            if (contact.user_id) {
                                await notify(notify_token, {
                                    "id_user": contact.id_user_core,
                                    "type": type,
                                    "id_ticket": ticket_id,
                                    "id_phase": phase_id
                                })
                            } else if (contact.email) {
                                await emailService.sendActiveMenssage("Ticket criado", contact.email, `Um ticket foi criado em uma fase de sua responsabilidade\n\nFase: ${contact.phase_description}`)
                            }
                        })
                    }
                    if (notifyPhase && notifyPhase.length > 0) {
                        notifyPhase.map(async contact => {
                            if (contact.user_id) {
                                await notify(notify_token, {
                                    "id_user": contact.id_user_core,
                                    "type": type,
                                    "id_ticket": ticket_id,
                                    "id_phase": phase_id
                                })
                            } else if (contact.email) {
                                await emailService.sendActiveMenssage("Ticket criado", contact.email, `Um ticket foi criado\n\nFase: ${contact.phase_description}`)
                            }
                        })
                    }

                    if (userResponsibleTicket && userResponsibleTicket.length > 0) {
                        await this._notifyUser(type, userResponsibleTicket, id_company, ticket_id, phase_id, notify_token, responsiblePhase, notifyPhase)
                    }
                    if (emailResponsibleTicket && emailResponsibleTicket.length > 0) {
                        for (let i = 0; i < emailResponsibleTicket.length; i++) {
                            await responsiblePhase.map(userPhase => { if (userPhase.id_user == emailResponsibleTicket[i]) { delete emailResponsibleTicket[i] } })

                            if (emailResponsibleTicket[i]) {
                                await notifyPhase.map(userPhase => { if (userPhase.id_user == emailResponsibleTicket[i] > 0) { delete emailResponsibleTicket[i] } })
                            }

                            if (emailResponsibleTicket[i]) {
                                let infoUser = await emailModel.getEmailById(emailResponsibleTicket[i], id_company)
                                email = await emailService.sendActiveMenssage("Ticket criado", infoUser[0].email, `Um ticket Digitalk foi criado em seu nome`)
                                await this.createLinkedEmailWithChatId(email.data.chatId, emailResponsibleTicket[i], ticket_id)
                            }
                        }
                    }
                    console.log("====== >", email)
                    break;
                case 5:
                    if (userResponsibleTicket && userResponsibleTicket.length > 0) {
                        await this._notifyUser(type, userResponsibleTicket, id_company, ticket_id, phase_id, notify_token)
                    }

                    if (emailResponsibleTicket && emailResponsibleTicket.length > 0) {
                        for (let i = 0; i < emailResponsibleTicket.length; i++) {
                            if (emailResponsibleTicket[i]) {
                                let infoUser = await emailModel.getEmailById(emailResponsibleTicket[i], id_company)
                                await emailService.sendActiveMenssage("Ticket Alert", infoUser[0].email, `Você foi alertado em um dos seus tickets`)
                            }
                        }
                    }
                    break;
                default:
                    console.log("Default")
                    break;
            }
            return true
        } catch (err) {
            console.log("Error when notify responsibles ==> ", err)
            return false
        }
    }

    async _notifyUser(type, user, id_company, id_ticket, id_phase, notify_token, responsiblePhase = null, notifyPhase = null) {
        try {
            for (let i = 0; i < user.length; i++) {
                if (responsiblePhase) {
                    await responsiblePhase.map(userPhase => { if (userPhase.id_user == user[i]) { delete user[i] } })
                }

                if (user[i] && notifyPhase) {
                    await notifyPhase.map(userPhase => { if (userPhase.id_user == user[i] > 0) { delete user[i] } })
                }
                if (user[i]) {
                    let infoUser = await userModel.getById(user[i], id_company)
                    await notify(notify_token, {
                        "id_user": infoUser[0].id_user_core,
                        "type": type,
                        "id_ticket": id_ticket,
                        "id_phase": id_phase
                    })
                }
            }

            return true
        } catch (err) {
            console.log("Error notify user => ", err)
            return err
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

            let result = await ticketModel.create(obj, "activities_ticket")
            console.log("TicketController -> createActivities -> result", result)

            if (result && result.length > 0) {
                obj.id = result[0].id

                const allResponsibles = await ticketModel.getAllResponsibleTicket(req.body.id_ticket)
                let userResponsibleTicket = []
                let emailResponsibleTicket = []
                await allResponsibles.map(value => {
                    if (value.id_user) {
                        userResponsibleTicket.push(value.id_user)
                    } else if (value.id_email) {
                        emailResponsibleTicket.push(value.id_email)
                    }
                })
                this._notify(ticket[0].id_phasae, req.company[0].notify_token, req.body.id_ticket, userResponsibleTicket, emailResponsibleTicket, id_company, 5)
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

            let result = await ticketModel.create(obj, attachments_ticket)

            if (result && result.length > 0) {
                obj.id = result[0].id

                const allResponsibles = await ticketModel.getAllResponsibleTicket(req.body.id_ticket)
                let userResponsibleTicket = []
                let emailResponsibleTicket = []
                await allResponsibles.map(value => {
                    if (value.id_user) {
                        userResponsibleTicket.push(value.id_user)
                    } else if (value.id_email) {
                        emailResponsibleTicket.push(value.id_email)
                    }
                })
                this._notify(ticket[0].id_phasae, req.company[0].notify_token, req.body.id_ticket, userResponsibleTicket, emailResponsibleTicket, id_company, 5)

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

            if (result[0].form) {
                result[0].form_data = await new FormDocuments(req.app.locals.db).findRegister(result[0].id_form)
                delete result[0].form
                delete result[0].id_form
            }
            if (result && result.length > 0) {
                delete result[0].id_company
                return res.status(200).send(result)
            }

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

    async updateTicket(req, res) {
        try {
            let userResponsible = []
            let emailResponsible = []

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
                ids_crm: req.body.ids_crm,
                id_customer: req.body.id_customer,
                updated_at: moment().format()
            }

            let result = await ticketModel.updateTicket(obj, req.params.id, req.headers.authorization)

            await this._createResponsibles(userResponsible, emailResponsible, req.params.id)

            let phase = await phaseModel.getPhase(req.body.id_phase, req.headers.authorization)

            if (!phase || phase.length <= 0)
                return res.status(400).send({ error: "Invalid id_phase uuid" })

            await phaseModel.disablePhaseTicket(req.params.id)

            let phase_id = await ticketModel.create({
                "id_phase": phase[0].id,
                "id_ticket": req.params.id
            }, "phase_ticket")

            if (!phase_id || phase.length <= 0)
                return res.status(500).send({ error: "There was an error" })

            await this._notify(phase[0].id, req.company[0].notify_token, req.params.id, userResponsible, emailResponsible, req.headers.authorization, 5)

            let ticket = await ticketModel.getTicketById(req.params.id, req.headers.authorization)
            await redis.set(`msTicket:ticket:${req.params.id}`, JSON.stringify(ticket[0]))

            if (result)
                return res.status(200).send(obj)

            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error when generate object to save ticket => ", err)
            return res.status(400).send({ error: "Error when generate object to save ticket" })
        }
    }

    async closedTicket(req, res) {
        try {
            const result = await ticketModel.closedTicket(req.params.id)
            if (result && result[0].id) {
                await redis.del(`msTicket:ticket:${result[0].id}`)
                return res.status(200).send(result)
            }
            return res.status(400).send({ error: "There was an error" })
        } catch (err) {
            console.log("Error when finaly ticket =>", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async setTicketAtRedis() {
        return new Promise(async (resolve, reject) => {
            await redis.KEYS(`msTicket:ticket:*`, async (err, res) => {
                if (res && res.length > 0) {
                    resolve(true)
                } else {
                    const tickets = await ticketModel.getAllTicketWhitoutCompanyId()
                    if (tickets && tickets.length > 0) {
                        for (const ticket of tickets) {
                            let result = await ticketModel.getTicketById(ticket.id, ticket.id_company)
                            await redis.set(`msTicket:ticket:${ticket.id}`, JSON.stringify(result[0]))
                        }
                        resolve(true)
                    }
                }
            })
        })
    }


    async checkSLATicket() {
        await redis.KEYS(`msTicket:ticket:*`, async (err, res) => {
            if (res && res.length > 0) {
                for (let ticket of res) {
                    let result = await redis.get(`${ticket}`)
                    result = JSON.parse(result)
                    let timeNow = await this.processCase(result)
                    if (timeNow >= result.sla_time) {
                        await ticketModel.updateSlaTicket({ sla: true, updated_at: moment().format() }, result.id)
                        const companyInfo = await companyModel.getById(result.id_company)
                        const allResponsibles = await ticketModel.getAllResponsibleTicket(result.id)
                        let userResponsibleTicket = []
                        let emailResponsibleTicket = []
                        await allResponsibles.map(value => {
                            if (value.id_user) {
                                userResponsibleTicket.push(value.id_user)
                            } else if (value.id_email) {
                                emailResponsibleTicket.push(value.id_email)
                            }
                        })
                        await this._notify(result.phase, companyInfo[0].notify_token, result.id, userResponsibleTicket, emailResponsibleTicket, result.id_company, 3)

                    }
                }
                return true
            } else {
                return true
            }
        })
    }

    async processCase(result) {
        let ticketTime
        let timeNow = moment()

        switch (result.unit_of_time) {
            case 1:
                ticketTime = moment(result.updated_at)
                timeNow = timeNow.diff(ticketTime, "seconds")
                break;
            case 2:
                ticketTime = moment(result.updated_at)
                timeNow = timeNow.diff(ticketTime, "minutes")

                break;
            case 3:
                ticketTime = moment(result.updated_at)
                timeNow = timeNow.diff(ticketTime, "hours")
                break;
            case 4:
                ticketTime = moment(result.updated_at)
                timeNow = timeNow.diff(ticketTime, "days")
                break;
            default:
                ticketTime = moment(result.updated_at)
                timeNow = timeNow.diff(ticketTime, "hours")
                break;
        }
        return timeNow
    }

    async _validateForm(db, id_form_template, form) {
        try {
            const errors = []
            const form_template = await new FormTemplate(db).findRegistes(id_form_template)
            for (let column of form_template.column) {
                column.required && form[column.column] ? "" : errors.push(`O campo ${column.label} é obrigatório`)
            }
            return errors
        } catch (err) {
            console.log("Error when generate Doc =>", err)
            return err
        }
    }
}

module.exports = TicketController