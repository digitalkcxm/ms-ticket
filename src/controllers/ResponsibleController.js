import moment from 'moment'
import UserController from './UserController.js'
import TicketModel from '../models/TicketModel.js'
import ResponsibleModel from '../models/ResponsibleModel.js'
import FormatTicket from '../helpers/FormatTicket.js'
export default class ResponsibleController {
  constructor(database = {}, logger = {}, redis = {}) {
    this.logger = logger
    this.database = database

    this.ticketModel = new TicketModel(database, logger)
    this.userController = new UserController(database, logger)
    this.responsibleModel = new ResponsibleModel(database, logger)
    this.formatTicket = new FormatTicket(database, logger, redis)
  }

  async responsibleTicket(req, res) {
    try {
      if (!Array.isArray(req.body.responsible) || (Array.isArray(req.body.responsible) && req.body.responsible.length <= 0))
        return res.status(400).send({ error: 'Campo responsible vazio!' })

      const ticket = await this.ticketModel.getTicketById(req.params.id, req.headers.authorization)
      if (!ticket || ticket.length < 0) return res.status(400).send({ error: 'Campo responsible vazio!' })

      const responsibleCheck = await this.responsibleModel.getActiveResponsibleByTicket(req.params.id)

      const act_user = await this.userController.checkUserCreated(req.body.act_user, req.headers.authorization, '', '', '', 1)

      const removeResponsible = await responsibleCheck.filter((x) => !req.body.responsible.find((y) => y.id_user === x.id_user))

      removeResponsible.forEach((x) => {
        this.responsibleModel.disableResponsible(x.id, act_user.id)
      })

      const addResponsible = await req.body.responsible.filter((x) => !responsibleCheck.find((y) => y.id_user === x.id_user))

      for (const user of addResponsible) {
        const result = await this.userController.checkUserCreated(
          user.id_user,
          req.headers.authorization,
          user.name ? user.name : '',
          user.phone ? user.phone : '',
          user.email ? user.email : '',
          1
        )

        await this.ticketModel.createResponsibleTicket({
          id_ticket: req.params.id,
          id_user: result.id,
          id_type_of_responsible: 2,
          active: true,
          created_at: moment(),
          updated_at: moment(),
          id_user_add: act_user.id
        })
      }

      return res.status(200).send(req.body)
    } catch (err) {
      this.logger.error(err, 'Erro ao vincular o ticket ao usuario.')
      return res.status(500).send({ error: 'Ocorreu um erro ao vincular o responsável do ticket' })
    }
  }
}
