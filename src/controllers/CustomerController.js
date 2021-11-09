const { v1 } = require("uuid")
const CompanyModel = require("../models/CompanyModel")
const CustomerModel = require("../models/CustomerModel")
const { validationResult } = require('express-validator');


const companyModel = new CompanyModel()
const customerModel = new CustomerModel()
const moment = require("moment")

class CustomerController {
    async create(req, res) {
        const errors = validationResult(req)
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

        try {
            let obj = {
                id_core: req.body.id_core,
                id_ticket: req.body.id_ticket,
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
                identification_document: req.body.identification_document,
                crm_ids: req.body.crm_ids,
                crm_contact_id: req.body.crm_contact_id,
                created_at: moment().format(),
                updated_at: moment().format()
            }

            const result = await customerModel.create(obj)
            if (result.length <= 0)
                return res.status(400).send({ error: "Error when manage customer info", result: result })

            if (result.code == "23502")
                return res.status(400).send({ error: "Please check your body" })

            obj.created_at = moment(obj.created_at).format("DD/MM/YYYY HH:mm:ss")
            obj.updated_at = moment(obj.updated_at).format("DD/MM/YYYY HH:mm:ss")
            return res.status(200).send(obj)

        } catch (err) {
            console.log("Error when manager customer info => ", err)
            return res.status(400).send({ error: "Error when manager customer info" })
        }
    }

    async getByID(req, res) {
        try {
            const result = await customerModel.getByID(req.body.id_ticket, req.params.id)
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

    async getByIDCore(req, res) {
        try {

            const result = await customerModel.getByIDCore(req.params.id_core)
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

    async getByTicket(req, res) {
        try {

            const result = await customerModel.getAll(req.body.id_ticket)
            if (result.length <= 0)
                return res.status(400).send({ error: result })

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
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
                identification_document: req.body.identification_document,
                crm_ids: req.body.crm_ids,
                crm_contact_id: req.body.crm_contact_id,
                updated_at: moment().format()
            }

            const result = await customerModel.update(obj, req.params.id)
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
  
  module.exports = CustomerController