import express from 'express'
import { verifyCompany } from '../middlewares/VerifyCompany.js'
import TicketController from '../controllers/TicketController.js'

export default function ticket(database = {}, logger = {}, redis = {}) {
  const router = express.Router()
  const ticketController = new TicketController(database, logger, redis)

  router.get('/sla_check/:type', (req, res) => ticketController.cronCheckSLA(req, res))

  router.use((req, res, next) => verifyCompany(req, res, next, database, logger))

  // type: 1 -> /15 * * * * *
  // type: 2 -> /5 * * * * *
  // type: 3 -> /30 * * * * *

  router.get('/history/:id', (req, res) => ticketController.history_ticket(req, res))

  router.get('/status', (req, res) => ticketController.ticketStatusCount(req, res))
  router.get('/count', (req, res) => ticketController.ticketResponsibleCount(req, res))

  router.get('/socket/:id', (req, res) => ticketController.getTicket(req, res))

  router.get('/:id', (req, res) => ticketController.getTicketByID(req, res))

  router.get('/protocol/:id', (req, res) => ticketController.getTicketByCustomerOrProtocol(req, res))
  router.get('/', (req, res) => ticketController.getAllTicket(req, res))

  router.post('/', async (req, res) => {
    const result = await ticketController.queueCreate(req.body)
    return res.status(201).json(result)
  })

  router.post('/activities', (req, res) => ticketController.createActivities(req, res))
  router.post('/attachments', (req, res) => ticketController.createAttachments(req, res))
  router.post('/start_ticket', (req, res) => ticketController.startTicket(req, res))

  router.post('/view', (req, res) => ticketController.viewTicket(req, res))

  router.post('/protocol', (req, res) => ticketController.linkProtocolToTicket(req, res))
  router.put('/close/:id', (req, res) => ticketController.closedTicket(req, res))

  router.post('/tab', (req, res) => ticketController.tab(req, res))

  return router
}
