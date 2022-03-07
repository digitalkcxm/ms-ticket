import pino from 'pino'

let logger = pino({
  name: process.env.PROJECT_NAME,
  level: process.env.LOG_LEVEL || 'info',
  customLevels: {
    http: 10
  },
  timestamp: createPatternTimestamp,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
})

function createPatternTimestamp() {
  const pattern = `,"time":"${new Date(Date.now()).toISOString()}"`
  return pattern
}

export default logger
