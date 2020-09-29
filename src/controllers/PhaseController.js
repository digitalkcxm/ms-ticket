const UnitOfTimeModel = require("../models/UnitOfTimeModel")
const PhaseModel = require("../models/PhaseModel")
const UserController = require("./UserController")
const DepartmentController = require("./DepartmentController")
const EmailController = require("./EmailController")
const moment = require("moment")
const { v1 } = require("uuid")
const UserModel = require("../models/UserModel")

const unitOfTimeModel = new UnitOfTimeModel()
const phaseModel = new PhaseModel()
const userController = new UserController()
const departmentController = new DepartmentController()
const emailController = new EmailController()

class PhaseController {
    async create(req, res) {
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
                    result = await userController.checkUserCreated(responsible.id, req.headers.authorization)
                    usersResponsible.push(result.id)
                } else if (responsible.email) {
                    result = await emailController.checkEmailCreated(responsible.email, req.headers.authorization)
                    emailResponsible.push(result.id)
                }
            })

            req.body.notify.map(async notify => {
                let result
                if (notify.id) {
                    result = await userController.checkUserCreated(notify.id, req.headers.authorization)
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
                "id": v1(),
                "id_company": req.headers.authorization,
                "id_unit_of_time": req.body.unit_of_time,
                "icon": req.body.icon,
                "name": req.body.name,
                "sla_time": req.body.sla_time,
                "responsible_notify_sla": req.body.notify_responsible,
                "supervisor_notify_sla": req.body.notify_supervisor,
                "created_at": moment().format(),
                "updated_at": moment().format()
            }
            let idPhase = await phaseModel.createPhase(obj)
            obj.id = idPhase[0].id

            if (usersResponsible.length > 0) {
                usersResponsible.map(async user => {
                    await phaseModel.createResponsiblePhase({
                        "id_phase": idPhase[0].id,
                        "id_user": user,
                        "id_type_of_responsible": 1
                    })
                })
            }

            if (emailResponsible.length > 0) {
                emailResponsible.map(async email => {
                    await phaseModel.createResponsiblePhase({
                        "id_phase": idPhase[0].id,
                        "id_email": email,
                        "id_type_of_responsible": 1
                    })
                })
            }

            if (usersNotify.length > 0) {
                usersNotify.map(async user => {
                    let index = usersResponsible.indexOf(user)
                    console.log("User", index)
                    if (index == '-1') {
                        await phaseModel.createNotifyPhase({
                            "id_phase": idPhase[0].id,
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
                            "id_phase": idPhase[0].id,
                            "id_email": email
                        })
                    }
                })
            }


            return res.status(200).send(obj)
        } catch (err) {
            console.log("Error when manage phase create => ", err)
            return res.status(400).send({ error: "Error when manage phase create" })
        }
    }
}

module.exports = PhaseController
