require('dotenv').config()
require('./helpers/CronJob')
const TicketController = require("./controllers/TicketController")

const { setTicketAtRedis } = new TicketController()
setTicketAtRedis()
require('./config/server').server
