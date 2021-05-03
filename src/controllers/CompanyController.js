
const { v1 } = require("uuid")
const CompanyModel = require("../models/CompanyModel")
const { validationResult } = require('express-validator');


const companyModel = new CompanyModel()
const moment = require("moment")

class CompanyController {
    async create(req, res) {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

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
            if (result.length <= 0)
                return res.status(400).send({ error: "Error when manage company info" })

            if (result.code == "23502")
                return res.status(400).send({ error: "Please check your body" })

            obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss")
            obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss")
            return res.status(200).send(obj)

        } catch (err) {
            console.log("Error when manager company info => ", err)
            return res.status(400).send({ error: "Error when manager company info" })
        }
    }

    async getByID(req, res) {
        try {

            const result = await companyModel.getById(req.headers.authorization)
            if (result.length <= 0)
                return res.status(400).send({ error: "Error when get company info" })

            result[0].created_at = moment(result[0].created_at).format("DD/MM/YYYY HH:mm:ss")
            result[0].updated_at = moment(result[0].updated_at).format("DD/MM/YYYY HH:mm:ss")

            return res.status(200).send(result)
        } catch (err) {
            console.log("Error when get company info => ", err)
            return res.status(400).send({ error: "Error when get company info" })
        }
    }

    async update(req, res) {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        try {
            let obj = {
                "name": req.body.name,
                "callback": req.body.callback,
                "active": req.body.active,
                "notify_token": req.body.notify_token,
                "updated_at": moment().format()
            }

            const result = await companyModel.update(obj, req.headers.authorization)
            if (result.name && result.name == 'error')
                return res.status(500).send({ error: "Contact microservice responsible" })

            result[0].created_at = moment(result[0].created_at).format("DD/MM/YYYY HH:mm:ss")
            result[0].updated_at = moment(result[0].updated_at).format("DD/MM/YYYY HH:mm:ss")
            return res.status(200).send(result)

        } catch (err) {
            console.log("Error when manage object to update company => ", err)
            return res.status(400).send({ error: "Error when manage object to update company" })
        }
    }
}

module.exports = CompanyController