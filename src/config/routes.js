import phase from '../routes/phase.js'
import ticket from '../routes/ticket.js'
import company from '../routes/company.js'
import customer from '../routes/customer.js'
import department from '../routes/department.js'
import responsible from '../routes/responsible.js'

export default (app, database, logger, redis) => {
  app.use('/api/v1/phase', phase(database, logger, redis))
  app.use('/api/v1/ticket', ticket(database, logger, redis))
  app.use('/api/v1/company', company(database, logger))
  app.use('/api/v1/customer', customer(database, logger, redis))
  app.use('/api/v1/department', department(database, logger))
  app.use('/api/v1/responsible', responsible(database, logger, redis))
  app.get('/api/v1/health', (req, res) => res.status(200).send('Ok!'))
}
