const UnitOfTimeModel = require("../models/UnitOfTimeModel")
const PhaseModel = require("../models/PhaseModel")
const UserController = require("./UserController")
const DepartmentController = require("./DepartmentController")
const EmailController = require("./EmailController")
const moment = require("moment")
const { v1 } = require("uuid")
const UserModel = require("../models/UserModel")
const TicketModel = require("../models/TicketModel")
const asyncRedis = require("async-redis")
const FormTemplate = require("../documents/FormTemplate")
const FormDocuments = require("../documents/FormDocuments")
const redis = asyncRedis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST)

const unitOfTimeModel = new UnitOfTimeModel()
const phaseModel = new PhaseModel()
const userController = new UserController()
const departmentController = new DepartmentController()
const emailController = new EmailController()
const ticketModel = new TicketModel()

class PhaseController {
    async create(req, res) {
        try {
            const dpt = []
            const usersResponsible = []
            const emailResponsible = []

            const usersNotify = []
            const emailNotify = []

            let obj = {
                "id": v1(),
                "id_company": req.headers.authorization,
                "id_unit_of_time": req.body.unit_of_time,
                "icon": req.body.icon,
                "name": req.body.name,
                "sla_time": req.body.sla_time,
                "responsible_notify_sla": req.body.notify_responsible,
                "supervisor_notify_sla": req.body.notify_supervisor,
                "form": req.body.form,
                "created_at": moment().format(),
                "updated_at": moment().format()
            }

            if (req.body.departments.length <= 0)
                return res.status(400).send({ error: "Invalid department id" })

            if (req.body.form) {
                const errorsColumns = await this._collumnTemplateValidate(req.body.column)
                if (errorsColumns.length > 0)
                    return res.status(400).send({ errors: errorsColumns })

                const formTemplate = await new FormTemplate(req.app.locals.db).createRegister(req.body.column)
                obj.id_form_template = formTemplate
            }

            let timeType = await unitOfTimeModel.getUnitOfTime(req.body.unit_of_time)
            if (!timeType || timeType.length <= 0)
                return res.status(400).send({ error: "Invalid information unit_of_time" })

            req.body.departments.map(async department => {
                let result = await departmentController.checkDepartmentCreated(department, req.headers.authorization)
                dpt.push(result[0].id)
            })

            req.body.responsible.map(async responsible => {
                let result
                if (responsible.id) {
                    result = await userController.checkUserCreated(responsible.id, req.headers.authorization, responsible.name)
                    usersResponsible.push(result.id)
                } else if (responsible.email) {
                    result = await emailController.checkEmailCreated(responsible.email, req.headers.authorization)
                    emailResponsible.push(result.id)
                }
            })

            req.body.notify.map(async notify => {
                let result
                if (notify.id) {
                    result = await userController.checkUserCreated(notify.id, req.headers.authorization, responsible.name)
                    usersNotify.push(result.id)
                } else if (notify.email) {
                    result = await emailController.checkEmailCreated(notify.email, req.headers.authorization)
                    emailNotify.push(result.id)
                }
            })

            let idPhase = await phaseModel.createPhase(obj)
            obj.id = idPhase[0].id

            for (let department_id of dpt) {
                await phaseModel.linkedEmail({
                    "id_department": department_id,
                    "id_phase": idPhase[0].id
                })
            }
            await this._responsiblePhase(idPhase[0].id, usersResponsible, emailResponsible)

            await this._notifyPhase(idPhase[0].id, usersNotify, emailNotify, usersResponsible, emailResponsible)

            delete obj.id_company
            return res.status(200).send(obj)
        } catch (err) {
            console.log("Error when manage phase create => ", err)
            return res.status(400).send({ error: "Error when manage phase create" })
        }
    }

    async getPhaseByID(req, res) {
        try {
            const result = await phaseModel.getPhaseById(req.params.id, req.headers.authorization)
            if (!result || result.length < 0)
                return res.status(400).send({ error: "Invalid id phase" })

            result[0].ticket = await ticketModel.getTicketByPhase(req.params.id)
            for (let ticket of result[0].ticket) {
                const typeMoment = await new UnitOfTimeModel().checkUnitOfTime(result[0].id_unit_of_time)
                ticket.countSLA = moment(ticket.created_at).add(result[0].sla_time, typeMoment)
                ticket.countSLA = moment(ticket.countSLA).format("DD/MM/YYYY HH:mm:ss")
                let first_interaction = await ticketModel.first_interaction(ticket.id)
                first_interaction.length ? ticket.first_message = moment(first_interaction[0].created_at).format("DD/MM/YYYY HH:mm:ss") : null

                if (ticket.id_form) {
                    ticket.form_data = await new FormDocuments(req.app.locals.db).findRegister(ticket.id_form)
                    delete ticket.id_form
                }
            }
            const register = await new FormTemplate(req.app.locals.db).findRegistes(result[0].id_form_template)
            result[0].formTemplate = register.column
            return res.status(200).send(result)
        } catch (err) {
            console.log("PhaseController -> getPhaseByID -> err", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async getAllPhase(req, res) {
        const search = (req.query.search) ? req.query.search : ''
        try {
            const result = await phaseModel.getAllPhase(req.headers.authorization)

            if (search) {
                if (isNaN(search)) {
                    const searchMongo = await new FormDocuments(req.app.locals.db).searchRegister(search)

                    for (let i in result) {

                        const arrayResponsible = []
                        const arrayNotify = []
                        result[i].ticket = []

                        for (const mongoResult of searchMongo) {
                            let ticket = await ticketModel.getTicketByIDForm(mongoResult._id, result[i].id)
                            if (ticket) {
                                const typeMoment = await new UnitOfTimeModel().checkUnitOfTime(result[i].id_unit_of_time)
                                ticket.countSLA = moment(ticket.created_at).add(result[i].sla_time, typeMoment)
                                ticket.countSLA = moment(ticket.countSLA).format("DD/MM/YYYY HH:mm:ss")
                                let first_interaction = await ticketModel.first_interaction(ticket.id)
                                first_interaction.length ? ticket.first_message = moment(first_interaction[0].created_at).format("DD/MM/YYYY HH:mm:ss") : null

                                if (ticket.id_form) {
                                    ticket.form_data = await new FormDocuments(req.app.locals.db).findRegister(ticket.id_form)
                                    delete ticket.id_form
                                }

                                let last_interaction = await ticketModel.last_interaction_ticket(ticket.id)
                                if (last_interaction && last_interaction.length) {
                                    ticket.last_message = last_interaction[0]
                                    ticket.last_message.created_at = moment(ticket.last_message.created_at).format("DD/MM/YYYY HH:mm:ss")
                                }
                                result[i].ticket.push(ticket)

                            }

                        }

                        const responsibles = await phaseModel.getResponsiblePhaseByIdPhase(result[i].id)

                        await responsibles.map(async value => {
                            if (value.email) { arrayResponsible.push({ "email": value.email }) } else if (value.user) { arrayResponsible.push({ "id": value.user }) }
                        })
                        result[i].responsible = arrayResponsible

                        const notify = await phaseModel.getNotifyPhaseByIdPhase(result[i].id)
                        await notify.map(async value => {
                            if (value.email) { arrayNotify.push({ "email": value.email }) } else if (value.user) { arrayNotify.push({ "id": value.id }) }
                        })
                        result[i].notify = arrayNotify


                        const department = await phaseModel.getDepartmentPhase(result[i].id)
                        result[i].department = []
                        await department.map(async value => { result[i].department.push(value.id_department) })

                        if (result[i].id_form_template) {
                            const register = await new FormTemplate(req.app.locals.db).findRegistes(result[i].id_form_template)
                            result[i].formTemplate = register.column
                        }
                    }
                } else {
                    for (let i in result) {
                        const arrayResponsible = []
                        const arrayNotify = []
                        result[i].ticket = await ticketModel.getTicketByPhase(result[i].id, search)
                        if (result[i].ticket.length > 0) {
                            for (let ticket of result[i].ticket) {
                                const typeMoment = await new UnitOfTimeModel().checkUnitOfTime(result[i].id_unit_of_time)
                                ticket.countSLA = moment(ticket.created_at).add(result[i].sla_time, typeMoment)
                                ticket.countSLA = moment(ticket.countSLA).format("DD/MM/YYYY HH:mm:ss")
                                let first_interaction = await ticketModel.first_interaction(ticket.id)
                                first_interaction.length ? ticket.first_message = moment(first_interaction[0].created_at).format("DD/MM/YYYY HH:mm:ss") : null

                                if (ticket.id_form) {
                                    ticket.form_data = await new FormDocuments(req.app.locals.db).findRegister(ticket.id_form)
                                    delete ticket.id_form
                                }

                                let last_interaction = await ticketModel.last_interaction_ticket(ticket.id)
                                if (last_interaction && last_interaction.length) {
                                    ticket.last_message = last_interaction[0]
                                    ticket.last_message.created_at = moment(ticket.last_message.created_at).format("DD/MM/YYYY HH:mm:ss")
                                }
                            }
                        }
                        const responsibles = await phaseModel.getResponsiblePhaseByIdPhase(result[i].id)

                        await responsibles.map(async value => {
                            if (value.email) { arrayResponsible.push({ "email": value.email }) } else if (value.user) { arrayResponsible.push({ "id": value.user }) }
                        })
                        result[i].responsible = arrayResponsible

                        const notify = await phaseModel.getNotifyPhaseByIdPhase(result[i].id)
                        await notify.map(async value => {
                            if (value.email) { arrayNotify.push({ "email": value.email }) } else if (value.user) { arrayNotify.push({ "id": value.id }) }
                        })
                        result[i].notify = arrayNotify


                        const department = await phaseModel.getDepartmentPhase(result[i].id)
                        result[i].department = []
                        await department.map(async value => { result[i].department.push(value.id_department) })

                        if (result[i].id_form_template) {
                            const register = await new FormTemplate(req.app.locals.db).findRegistes(result[i].id_form_template)
                            result[i].formTemplate = register.column
                        }
                    }
                }
            } else {
                for (let i in result) {
                    const arrayResponsible = []
                    const arrayNotify = []
                    result[i].ticket = await ticketModel.getTicketByPhase(result[i].id)

                    if (result[i].ticket.length > 0) {
                        for (let ticket of result[i].ticket) {
                            const typeMoment = await new UnitOfTimeModel().checkUnitOfTime(result[i].id_unit_of_time)
                            ticket.countSLA = moment(ticket.created_at).add(result[i].sla_time, typeMoment)
                            ticket.countSLA = moment(ticket.countSLA).format("DD/MM/YYYY HH:mm:ss")
                            let first_interaction = await ticketModel.first_interaction(ticket.id)
                            first_interaction.length ? ticket.first_message = moment(first_interaction[0].created_at).format("DD/MM/YYYY HH:mm:ss") : null

                            if (ticket.id_form) {
                                ticket.form_data = await new FormDocuments(req.app.locals.db).findRegister(ticket.id_form)
                                delete ticket.id_form
                            }

                            let last_interaction = await ticketModel.last_interaction_ticket(ticket.id)
                            if (last_interaction && last_interaction.length) {
                                ticket.last_message = last_interaction[0]
                                ticket.last_message.created_at = moment(ticket.last_message.created_at).format("DD/MM/YYYY HH:mm:ss")
                            }
                        }
                    }
                    const responsibles = await phaseModel.getResponsiblePhaseByIdPhase(result[i].id)

                    await responsibles.map(async value => {
                        if (value.email) { arrayResponsible.push({ "email": value.email }) } else if (value.user) { arrayResponsible.push({ "id": value.user }) }
                    })
                    result[i].responsible = arrayResponsible

                    const notify = await phaseModel.getNotifyPhaseByIdPhase(result[i].id)
                    await notify.map(async value => {
                        if (value.email) { arrayNotify.push({ "email": value.email }) } else if (value.user) { arrayNotify.push({ "id": value.id }) }
                    })
                    result[i].notify = arrayNotify


                    const department = await phaseModel.getDepartmentPhase(result[i].id)
                    result[i].department = []
                    await department.map(async value => { result[i].department.push(value.id_department) })

                    if (result[i].id_form_template) {
                        const register = await new FormTemplate(req.app.locals.db).findRegistes(result[i].id_form_template)
                        result[i].formTemplate = register.column
                    }

                }
            }

            return res.status(200).send(result)
        } catch (err) {
            console.log("Get all phase => ", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async updatePhase(req, res) {
        try {
            const dpt = []
            const usersResponsible = []
            const emailResponsible = []

            const usersNotify = []
            const emailNotify = []

            if (req.body.departments.length <= 0)
                return res.status(400).send({ error: "Invalid department id" })

            req.body.departments.map(async department => {
                let result = await departmentController.checkDepartmentCreated(department, req.headers.authorization)
                dpt.push(result[0].id)
            })

            req.body.responsible.map(async responsible => {
                let result
                if (responsible.id) {
                    result = await userController.checkUserCreated(responsible.id, req.headers.authorization, responsible.name)
                    usersResponsible.push(result.id)
                } else if (responsible.email) {
                    result = await emailController.checkEmailCreated(responsible.email, req.headers.authorization)
                    emailResponsible.push(result.id)
                }
            })

            req.body.notify.map(async notify => {
                let result
                if (notify.id) {
                    result = await userController.checkUserCreated(notify.id, req.headers.authorization, responsible.name)
                    usersNotify.push(result.id)
                } else if (notify.email) {
                    result = await emailController.checkEmailCreated(notify.email, req.headers.authorization)
                    emailNotify.push(result.id)
                }
            })

            let timeType = await unitOfTimeModel.getUnitOfTime(req.body.unit_of_time)
            if (!timeType || timeType.length <= 0)
                return res.status(400).send({ error: "Invalid information unit_of_time" })

            let obj = {
                "id_unit_of_time": req.body.unit_of_time,
                "icon": req.body.icon,
                "name": req.body.name,
                "sla_time": req.body.sla_time,
                "responsible_notify_sla": req.body.notify_responsible,
                "supervisor_notify_sla": req.body.notify_supervisor,
                "updated_at": moment().format()
            }
            await phaseModel.updatePhase(obj, req.params.id, req.headers.authorization)
            obj.id = req.params.id

            await phaseModel.removeLinkedDepartment(req.params.id)
            for (let department_id of dpt) {
                await phaseModel.linkedEmail({
                    "id_department": department_id,
                    "id_phase": req.params.id
                })
            }

            await this._responsiblePhase(req.params.id, usersResponsible, emailResponsible)

            await this._notifyPhase(req.params.id, usersNotify, emailNotify, usersResponsible, emailResponsible)


            return res.status(200).send(obj)
        } catch (err) {
            console.log("Error when manage phase create => ", err)
            return res.status(400).send({ error: "Error when manage phase create" })
        }
    }

    async _responsiblePhase(phase_id, usersResponsible, emailResponsible) {
        try {
            await phaseModel.delNotifyPhase(phase_id)

            if (usersResponsible.length > 0) {
                usersResponsible.map(async user => {
                    await phaseModel.createResponsiblePhase({
                        "id_phase": phase_id,
                        "id_user": user,
                        "id_type_of_responsible": 1
                    })
                })
            }

            if (emailResponsible.length > 0) {
                emailResponsible.map(async email => {
                    await phaseModel.createResponsiblePhase({
                        "id_phase": phase_id,
                        "id_email": email,
                        "id_type_of_responsible": 1
                    })
                })
            }
        } catch (err) {
            console.log("Error responsible Phase => ", err)
            return err
        }
    }

    async _notifyPhase(phase_id, usersNotify, emailNotify, usersResponsible, emailResponsible) {
        try {

            if (usersNotify.length > 0) {
                usersNotify.map(async user => {
                    let index = usersResponsible.indexOf(user)
                    console.log("User", index)
                    if (index == '-1') {
                        await phaseModel.createNotifyPhase({
                            "id_phase": phase_id,
                            "id_user": user
                        })
                    }
                })
            }
            if (emailNotify.length > 0) {
                emailNotify.map(async email => {
                    let index = emailResponsible.indexOf(email)
                    console.log("Email", index)
                    if (index == '-1') {
                        await phaseModel.createNotifyPhase({
                            "id_phase": phase_id,
                            "id_email": email
                        })
                    }
                })
            }
        } catch (err) {
            console.log("Error notify Phase => ", err)
            return err
        }
    }

    async _collumnTemplateValidate(columns) {
        let errors = []
        for (let i = 0; i < columns.length; i++) {
            columns[i].label ? "" : errors.push(`item ${i}: label é um campo obrigatório`)
            columns[i].column ? "" : errors.push(`item ${i}: column é um campo obrigatório`)
            typeof columns[i].required === "boolean" ? "" : errors.push(`item ${i}: required é um campo booleano`)
            typeof columns[i].editable === "boolean" ? "" : errors.push(`item ${i}: o campo editable é um campo booleano`)
            columns[i].type ? "" : errors.push(`item ${i}: type é um campo obrigatório`)
        }
        return errors
    }
}

module.exports = PhaseController
