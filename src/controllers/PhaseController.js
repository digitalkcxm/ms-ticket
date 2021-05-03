const { v1 } = require("uuid")

const moment = require("moment")

const PhaseModel = require("../models/PhaseModel")
const phaseModel = new PhaseModel()

const UserController = require("./UserController")
const userController = new UserController()

const TicketModel = require("../models/TicketModel")
const ticketModel = new TicketModel()

const FormTemplate = require("../documents/FormTemplate")
const FormDocuments = require("../documents/FormDocuments")

const UnitOfTimeModel = require("../models/UnitOfTimeModel")
const unitOfTimeModel = new UnitOfTimeModel()

const TypeColumnModel = require("../models/TypeColumnModel")
const typeColumnModel = new TypeColumnModel()

const DepartmentController = require("./DepartmentController")
const departmentController = new DepartmentController()

const asyncRedis = require("async-redis")
const redis = asyncRedis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST)

const { formatTicketForPhase } = require("../helpers/FormatTicket")

const { validationResult } = require('express-validator');

const DepartmentModel = require("../models/DepartmentModel")
const departmentModel = new DepartmentModel()

class PhaseController {
    async create(req, res) {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        try {
            const usersResponsible = []
            const usersNotify = []

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
                "updated_at": moment().format(),
                "active": req.body.active
            }

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

            let idPhase = await phaseModel.createPhase(obj)
            obj.id = idPhase[0].id

            let result = await departmentController.checkDepartmentCreated(req.body.department, req.headers.authorization)
            await phaseModel.linkedDepartment({
                "id_department": result[0].id,
                "id_phase": idPhase[0].id,
                "active": true
            })

            for await (const responsible of req.body.responsible) {
                let result
                result = await userController.checkUserCreated(responsible, req.headers.authorization, responsible.name)
                usersResponsible.push(result.id)
            }

            for await (const notify of req.body.notify) {
                let result
                result = await userController.checkUserCreated(notify, req.headers.authorization, notify.name)
                usersNotify.push(result.id)
            }

            await this._responsiblePhase(idPhase[0].id, usersResponsible)

            await this._notifyPhase(idPhase[0].id, usersNotify, usersResponsible)
            obj.notify = req.body.notify
            obj.responsible = req.body.responsible
            delete obj.id_company
            obj.id_form_template
            obj.column = req.body.column
            obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss")
            obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss")

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

            const tickets = await ticketModel.getTicketByPhase(result[0].id)
            result[0].ticket = []
            for await (let ticket of tickets) {
                const ticketFormated = await formatTicketForPhase(result, req.app.locals.db, ticket)
                result[0].ticket.push(ticketFormated)
            }
            result[0] = await this._formatPhase(result[0], req.app.locals.db)
            return res.status(200).send(result)
        } catch (err) {
            console.log("PhaseController -> getPhaseByID -> err", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async getAllPhase(req, res) {
        const search = (req.query.search) ? req.query.search : ''
        let result
        try {

            if (search) {
                result = await phaseModel.getAllPhase(req.headers.authorization)

                if (isNaN(search)) {
                    const searchMongo = await new FormDocuments(req.app.locals.db).searchRegister(search)

                    for (let i in result) {
                        result[i].ticket = []

                        for (const mongoResult of searchMongo) {
                            let ticket = await ticketModel.getTicketByIDForm(mongoResult._id, result[i].id)
                            if (ticket)
                                result[i].ticket = await formatTicketForPhase(result[i].id, req.app.locals.db, ticket)
                        }
                        result[i] = await this._formatPhase(result[i], req.app.locals.db)
                    }
                } else {
                    for (let i in result) {
                        const tickets = await ticketModel.getTicketByPhase(result[i].id, search)
                        result[i].ticket = []
                        for await (let ticket of tickets) {
                            result[i].ticket = await formatTicketForPhase(result[i].id, req.app.locals.db, ticket)
                        }
                        result[i] = await this._formatPhase(result[i], req.app.locals.db)
                    }
                }
            } else if (req.query.departments) {
                result = await this._getByDepartment(req.query.departments, req.headers.authorization, req.app.locals.db)
            } else {
                result = await phaseModel.getAllPhase(req.headers.authorization)

                for (let i in result) {
                    const tickets = await ticketModel.getTicketByPhase(result[i].id, search)
                    result[i].ticket = []
                    for await (let ticket of tickets) {
                        result[i].ticket = await formatTicketForPhase(result[i].id, req.app.locals.db, ticket)
                    }
                    result[i] = await this._formatPhase(result[i], req.app.locals.db)
                }
            }

            return res.status(200).send(result)
        } catch (err) {
            console.log("Get all phase => ", err)
            return res.status(400).send({ error: "There was an error" })
        }
    }

    async updatePhase(req, res) {
        // const errors = validationResult(req)
        // if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
        try {
            const usersResponsible = []
            const usersNotify = []

            const dpt = []

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
                "updated_at": moment().format(),
                "active": req.body.active
            }

            await phaseModel.updatePhase(obj, req.params.id, req.headers.authorization)
            obj.id = req.params.id

            let result = await departmentController.checkDepartmentCreated(req.body.department, req.headers.authorization)

            let departmentLinkedWithPhase = await phaseModel.selectLinkedDepartment(req.params.id)
            if (departmentLinkedWithPhase.length <= 0)
                return res.status(400).send({ error: "Phase without linked department" })

            if (departmentLinkedWithPhase[0].id_department != result[0].id) {
                await phaseModel.linkedDepartment({
                    "id_department": result[0].id,
                    "id_phase": req.params.id,
                    "active": true,
                })
            }

            for await (const responsible of req.body.responsible) {
                let resultUser
                resultUser = await userController.checkUserCreated(responsible, req.headers.authorization, responsible.name)
                usersResponsible.push(resultUser.id)
            }

            for await (const notify of req.body.notify) {
                let resultUser
                resultUser = await userController.checkUserCreated(notify, req.headers.authorization, notify.name)
                usersNotify.push(resultUser.id)
            }

            await this._responsiblePhase(req.params.id, usersResponsible)

            await this._notifyPhase(req.params.id, usersNotify, usersResponsible)

            obj.notify = req.body.notify
            obj.responsible = req.body.responsible
            let phase = await phaseModel.getPhaseById(req.params.id, req.headers.authorization)
            let validations = await this._checkColumnsFormTemplate(req.body.column, req.app.locals.db, phase[0].id_form_template)
            if (validations.length > 0)
                return res.status(400).send({ error: validations })

            validations.column = req.body.column
            await new FormTemplate(req.app.locals.db).updateRegister(validations._id, validations)
            phase[0].department = req.body.department
            phase[0].formTemplate = req.body.column
            delete phase[0].id_form_template
            return res.status(200).send(phase)
        } catch (err) {
            console.log("Error when manage phase update => ", err)
            return res.status(400).send({ error: "Error when manage phase update" })
        }
    }

    async _responsiblePhase(phase_id, usersResponsible) {
        try {
            await phaseModel.delResponsiblePhase(phase_id)

            if (usersResponsible.length > 0) {
                usersResponsible.map(async user => {
                    await phaseModel.createResponsiblePhase({
                        "id_phase": phase_id,
                        "id_user": user,
                        "id_type_of_responsible": 1,
                    })
                })
            }
        } catch (err) {
            console.log("Error responsible Phase => ", err)
            return err
        }
    }

    async _notifyPhase(phase_id, usersNotify, usersResponsible) {
        try {
            await phaseModel.delNotifyPhase(phase_id)

            if (usersNotify.length > 0) {
                usersNotify.map(async user => {
                    console.log("User", user)
                    await phaseModel.createNotifyPhase({
                        "id_phase": phase_id,
                        "id_user": user,
                    })
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
            typeof columns[i].editable === "boolean" ? "" : errors.push(`item ${i}: o campo editable é um campo booleano`)
            columns[i].type || columns[i].type >= 0 ? "" : errors.push(`item ${i}: type é um campo obrigatório`)
            columns[i].column ? "" : errors.push(`item ${i}: column é um campo obrigatório`)
            columns[i].label ? "" : errors.push(`item ${i}: label é um campo obrigatório`)
            typeof columns[i].required === "boolean" ? "" : errors.push(`item ${i}: required é um campo booleano`)

            let type = await typeColumnModel.getTypeByID(columns[i].type)
            if (type.length <= 0) errors.push(`item ${i}: Invalid type`)
        }
        return errors
    }

    async _checkColumnsFormTemplate(newTemplate, db, template) {

        const register = await new FormTemplate(db).findRegistes(template)
        const errors = []
        if (newTemplate.length < register.column.length)
            errors.push("Não é possivel remover campos do formulario, apenas inativa-los")

        register.column.map(valueA => {
            let validate = 0
            newTemplate.map(valueB => valueA.column == valueB.column ? validate++ : '')
            console.log(validate, valueA.label)

            if (validate <= 0)
                errors.push(`A coluna ${valueA.label} não pode ser removido ou o valor do campo column não pode ser alterado, apenas inativado`)

            if (validate > 1)
                errors.push(`A coluna ${valueA.label} não pode ser igual a um ja criado`)

        })
        if (errors.length > 0)
            return errors

        return register
    }

    async _formatPhase(result, mongodb) {
        const department = await phaseModel.getDepartmentPhase(result.id)
        result.department = department[0].id_department

        const unit_of_time = await unitOfTimeModel.getUnitOfTime(result.id_unit_of_time)
        result.unit_of_time = unit_of_time[0].name
        const responsibles = await phaseModel.getResponsiblePhase(result.id)
        result.responsible = []
        responsibles.map(value => result.responsible.push(value.id_user_core))

        const notify = await phaseModel.getNotifiedPhase(result.id)
        result.notify = []
        notify.map(value => result.notify.push(value.id_user_core))

        if (result.id_form_template) {
            const register = await new FormTemplate(mongodb).findRegistes(result.id_form_template)
            result.formTemplate = register.column
        }
        result.created_at = moment(result.created_at).format("DD/MM/YYYY HH:mm:ss")
        result.updated_at = moment(result.updated_at).format("DD/MM/YYYY HH:mm:ss")
        delete result.id_form_template
        return result
    }

    async _getByDepartment(departments, authorization, db) {
        try {
            let phases = []
            departments = JSON.parse(departments)
            if (departments.length > 0) {
                for (const department of departments) {

                    const department_id = await departmentModel.getByID(department, authorization)
                    if (department_id && department_id.length <= 0)
                        return false

                    const result = await phaseModel.getPhasesByDepartmentID(department_id[0].id)
                    for (const phase of result) {
                        if (phase.id_form_template && phase.form) {
                            const register = await new FormTemplate(db).findRegistes(phase.id_form_template)
                            if (register && register.column)
                                phase.formTemplate = register.column

                            delete phase.id_form_template
                        }
                        phase.department = department
                        phases.push(phase)
                    }
                }
                return phases
            }

        } catch (err) {
            console.log(err)
            return { error: "Houve algum erro ao captar o departamento pelo id" }
        }
    }
}

module.exports = PhaseController
