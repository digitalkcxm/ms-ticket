import request from 'supertest'
import { app } from '../../src/config/server.js'



describe('Company integration test', () => {

    let sharedCompany = {};
    const modelCompany = {
        name: "Digital",
        callback: "http://localhost:5016/api/v1/ticket/callback",
        active: "true",
        notify_token: "2as4d8a0sfds923njklfpcvlnmsdopev90pkldwdfs"
    }

    it("[POST: /api/v1/company] - should not create a company with just name", async () => {
        const newCompany = {
            name: "test-Should-not-create-this-Company",
        }
        const response = await request(app).post('/api/v1/company').send(newCompany)

        expect(response.status).toBe(400)
    })

    it("[POST: /api/v1/company] - should not create a company with invalid active value", async () => {
        const newCompany = {
            name: "Invalid Digitalk Company",
            callback: "http://localhost:5016/api/v1/ticket/callback",
            active: "null",
            notify_token: "likasfd900sfds923njaasasafgnmsdopev90pklkaopa7",
        }

        const response = await request(app).post('/api/v1/company').send(newCompany)

        expect(response.status).toBe(400)
    })

    it("[POST: /api/v1/company] - should not create a company with empty information", async () => {
        const newCompany = {
            name: "",
            callback: "",
            active: "",
            notify_token: "",
        }
        const response = await request(app).post('/api/v1/company').send(newCompany)

        expect(response.status).toBe(400)
    })

    it("[POST: /api/v1/company] - should create a company", async () => {
        const response = await request(app).post('/api/v1/company').send(modelCompany)
        expect(response.status).toBe(200)

        sharedCompany = response.body
    })

    it("[POST: /api/v1/company] - should create a company and have all properties", async () => {
        const newCompany = {
            name: "Tesla",
            callback: "http://tesla/api/v1/ticket/callback",
            active: "true",
            notify_token: "dash190nasd00ismkao1afagp15qajidophas9dyha9qw",
        }

        const response = await request(app).post('/api/v1/company').send(newCompany)
        expect(response.status).toBe(200)

        const bodyContent = response.body
        expect(bodyContent).toHaveProperty('id')
        expect(bodyContent).toHaveProperty('name')
        expect(bodyContent).toHaveProperty('callback')
        expect(bodyContent).toHaveProperty('active')
        expect(bodyContent).toHaveProperty('notify_token')
        expect(bodyContent).toHaveProperty('created_at')
        expect(bodyContent).toHaveProperty('updated_at')
    })

    it('[GET: /api/v1/company] - should not get a company by ID without authentication token', async () => {
        const id = sharedCompany.id

        const response = await request(app).get('/api/v1/company').set('authorization', '')

        expect(response.status).toBe(400)
    })


    it('[GET: /api/v1/company] - should get a company by ID', async () => {
        const authorizationToken = sharedCompany.id

        const response = await request(app).get(`/api/v1/company`).set(`authorization`, authorizationToken)


        expect(response.status).toBe(200)

        const bodyContent = response.body[0]
        expect(bodyContent).toHaveProperty('id')
        expect(bodyContent).toHaveProperty('name')
        expect(bodyContent).toHaveProperty('callback')
        expect(bodyContent).toHaveProperty('active')
        expect(bodyContent).toHaveProperty('notify_token')
        expect(bodyContent).toHaveProperty('created_at')
        expect(bodyContent).toHaveProperty('updated_at')

    })

   it("[PUT: /api/v1/company] - should not allow to update a company", async () => {
       const token = sharedCompany.id
       let updatedCompany = {
           id: 'should-not-be-this-id',
           name: 'should not be updated'
       }

       const response = await request(app).put('/api/v1/company').set(updatedCompany, 'authorization', token)

       expect(response.status).toBe(400)
   })

    it("[PUT: /api/v1/company] - should allow to update a company", async () => {
        const token = sharedCompany.id

        const requestBody = {
            name: "Digitalk",
            callback: "https://localhost:5000/api/v1/ticket/callback",
            notify_token: "2b0451CHzq7ihyeBN7alQBCEuxlJHwNlNk3wkEPsNgiX2mJimz9j9NLO",
            active: "true"
        }

        const response = await request(app)
            .put('/api/v1/company')
            .send(requestBody)
            .set('authorization', token)

        expect(response.status).toBe(200)
    })

})


