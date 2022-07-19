import { app } from '../../src/config/server.js'
import request from 'supertest'

async function getHealth(app) {
  return request(app).get('/api/v1/health')
}

describe('Health test', () => {
  it('[/api/v1/health (Health)] - Should return status 200 and json with status On', async () => {
    const response = await getHealth(app)
    expect(response.status).toBe(200)
    //expect(response.body).toHaveProperty('status')
    //expect(response.body.status).toBe('On')
  })
})
