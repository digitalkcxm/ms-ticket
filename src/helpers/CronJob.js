const Cron = require("cron").CronJob

const TicketController = require("../controllers/TicketController")

const ticketController = new TicketController()

const setTicketAtRedis = new Cron("*/10 * * * *", async () => await ticketController.setTicketAtRedis(), null, true)
const checkSLATicket = new Cron("* * * * *", async () => await ticketController.checkSLATicket(), null, true)