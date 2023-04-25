import { v1 } from 'uuid'
import moment from 'moment'
import CompanyModel from '../models/CompanyModel.js'
import { validationResult } from 'express-validator'

export default class CompanyController {
  constructor(database, logger) {
    this.logger = logger
    this.companyModel = new CompanyModel(database, logger)
  }

  async create(req, res) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const validateCompany = await this.companyModel.getByName(req.body.name)
    if (validateCompany.length > 0) return res.status(400).json({ error: 'Already exists company with this name.' })

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

      const result = await this.companyModel.create(obj)
      if (result.length <= 0) return res.status(400).send({ error: 'Error when manage company info' })

      if (result.code == '23502') return res.status(400).send({ error: 'Please check your body' })

      // obj.created_at = moment(obj.created_at).format('DD/MM/YYYY HH:mm:ss')
      // obj.updated_at = moment(obj.updated_at).format('DD/MM/YYYY HH:mm:ss')

      this.logger.info(`Company ${obj.name} created.`)
      return res.status(200).send(obj)
    } catch (err) {
      this.logger.error(err, 'Error when create company')
      return res.status(400).send({ error: 'Error when create company' })
    }
  }

  async getByID(req, res) {
    try {
      const result = await this.companyModel.getById(req.headers.authorization)
      if (result.length <= 0) return res.status(400).send({ error: 'Error when get company info' })

      // result[0].created_at = moment(result[0].created_at).format('DD/MM/YYYY HH:mm:ss')
      // result[0].updated_at = moment(result[0].updated_at).format('DD/MM/YYYY HH:mm:ss')

      this.logger.info(`Get company ${result[0].name}`)
      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, `Error when catch company with ID ${req.headers.authorization}`)
      return res.status(400).send({ error: 'Error when get company info' })
    }
  }

  async update(req, res) {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      let obj = {
        name: req.body.name,
        callback: req.body.callback,
        active: req.body.active,
        notify_token: req.body.notify_token,
        updated_at: moment().format()
      }

      const result = await this.companyModel.update(obj, req.headers.authorization)
      if (result.name && result.name == 'error') return res.status(500).send({ error: 'Contact microservice responsible' })

      // result[0].created_at = moment(result[0].created_at).format('DD/MM/YYYY HH:mm:ss')
      // result[0].updated_at = moment(result[0].updated_at).format('DD/MM/YYYY HH:mm:ss')

      this.logger.info(`Update company ${obj.name}.`)
      return res.status(200).send(result)
    } catch (err) {
      this.logger.error(err, 'Error when manage object to update company. ')
      return res.status(400).send({ error: 'Error when manage object to update company' })
    }
  }
}
