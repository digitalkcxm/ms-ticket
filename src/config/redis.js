import redis from 'ioredis'

export default class Redis {
  static newConnection() {
    const environment = process.env.NODE_ENV | process.env.STATE_ENV
    const port = environment === 'testing' ? process.env.REDIS_PORT_TEST : process.env.REDIS_PORT
    const host = environment === 'testing' ? process.env.REDIS_HOST_TEST : process.env.REDIS_HOST
    return new redis(port, host, {
      maxRetriesPerRequest: 10
    })
  }
}
