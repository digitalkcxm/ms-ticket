
const { v1 } = require("uuid")
const CompanyModel = require("../models/CompanyModel")


const companyModel = new CompanyModel()
const moment = require("moment")

class CompanyController {
    async create(req, res) {
        try {
            let obj = {
                id: v1(),
                name: req.body.name,
                callback: req.body.callback,
                active: req.body.active,
                notify_token: req.body.notify_token,
                created_at: moment().format(),
                updated_at: moment().format()
            }

            const result = await companyModel.create(obj)
            if (result.length > 0)
                return res.status(200).send(obj)

            if (result.code = "23502")
                return res.status(400).send({ error: "Please check your body" })

            return res.status(400).send({ error: "Error when manage company info" })
        } catch (err) {
            console.log("Error when manager company info => ", err)
            return res.status(400).send({ error: "Error when manager company info" })
        }
    }

    async getByID(req, res) {
        try {
            const result = await companyModel.getById(req.headers.authorization)
            if (result.length > 0)
                return res.status(200).send(result)

            return res.status(400).send({ error: "Error when get company info" })
        } catch (err) {
            console.log("Error when get company info => ", err)
            return res.status(400).send({ error: "Error when get company info" })
        }
    }

    async update(req, res) {
        try {
            let obj = {
                "name": req.body.name,
                "callback": req.body.callback,
                "active": req.body.active,
                "notify_token": req.body.notify_token,
                "updated_at": moment().format()
            }
            const result = await companyModel.update(obj, req.headers.authorization)
            if (result && result == 1)
                return res.status(200).send(obj)

            return res.status(400).send({ error: "Error when manage object to update company" })
        } catch (err) {
            console.log("Error when manage object to update company => ", err)
            return res.status(400).send({ error: "Error when manage object to update company" })
        }
    }
}

module.exports = CompanyController