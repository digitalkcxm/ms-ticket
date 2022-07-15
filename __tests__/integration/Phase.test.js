import { app } from '../../src/config/server.js'
import request from 'supertest'
import database from "../../src/config/database/database.js";
import logger from "../../src/config/logger.js";
import DepartmentModel from "../../src/models/DepartmentModel.js"

import PhaseModel from "../../src/models/PhaseModel.js"

describe('Teste de integração das phases', () => {

    // Padrão do teste
    let company_default = {}
    let phase_default = {}
    let phase_testOrder1 = {}
    let phase_testOrder2 = {}
    let phase_testOrder3 = {}
    let department_default = {}

    // Prepara o ambiente de teste
    beforeAll(async () => {
        try {
            // COMPANY CREATION ============================================
            const defaultCompanyModel = {
                name: "Company de teste da Phase",
                callback: "http://phasecompany:5016/api/v1/ticket/callback",
                active: "true",
                notify_token: "lh8b02sgf6in2c3aqicxzzly9yo1f3hqags08b7e"
            }
            const companyCreation_Response = await request(app).post('/api/v1/company').send(defaultCompanyModel)
            company_default = companyCreation_Response.body



            // DEPARTMENT CREATION ===========================================
            const newDepartment = {
                id_company: company_default.id,
                id_department_core: 87
            }
            const departmentModel = new DepartmentModel(database, logger)
            const departmentCreation_Response = await departmentModel.create(newDepartment)
            department_default = departmentCreation_Response[0]

        }catch (err){
            console.log(`erro: ${err}`)
            return err
        }
    })


    it('[POST: /api/v1/phase/] Create the simplest phase possible and expect to have all properties', async () => {

        phase_default = {
            name: 'simpleDefaultPhase',
            department: department_default.id,
            form: false, //Campo obrigatório
        }

        const response = await request(app).post('/api/v1/phase').set('authorization', company_default.id).send(phase_default)
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('id')
        expect(response.body.name).toBe(phase_default.name)
        expect(response.body.form).toBe(false)
        expect(response.body).toHaveProperty('created_at')
        expect(response.body).toHaveProperty('updated_at')
        expect(response.body).toHaveProperty('notification_separate')
        expect(response.body).toHaveProperty('department_can_create_protocol')
        expect(response.body).toHaveProperty('department_can_create_ticket')
        expect(response.body).toHaveProperty('ticket')
        expect(response.body).toHaveProperty('header')
        expect(response.body).toHaveProperty('sla')
        expect(response.body).toHaveProperty('separate')

        //response.body.HEADER PROPERTIES =========================================
        expect(response.body.header).toHaveProperty('campos_calculados')
        expect(response.body.header).toHaveProperty('total_tickets')
        expect(response.body.header).toHaveProperty('open_tickets')
        expect(response.body.header).toHaveProperty('closed_tickets')
        expect(response.body.header).toHaveProperty('percent_open_tickets')
        expect(response.body.header).toHaveProperty('percent_closed_tickets')
        expect(response.body.header).toHaveProperty('counter_sla')
        expect(response.body.header).toHaveProperty('counter_sla_closed')

        //Se a resposta for 200, modifica o phase_default para possuir
        // todas as propriedades para os testes seguintes.
        if(response.status === 200)
            phase_default = response.body
    })

    it('[GET: /api/v1/phase/:id] Get phase by ID', async () => {

        const req = {
            id: phase_default.id,
            authorization: company_default.id
        }
        const response = await request(app).get(`/api/v1/phase/${req.id}`).set('authorization', req.authorization)
        expect(response.status).toBe(200)
    })

    it('[PUT: /api/v1/phase/:id] Should update the company changing the Icon', async () => {

        const updatedPhase = {
            id: phase_default.id,
            department: department_default.id,
            authorization: company_default.id,
            icon: "😛",
        }

        const response = await request(app).put(`/api/v1/phase/${updatedPhase.id}`).set('authorization', updatedPhase.authorization).send(updatedPhase)
        expect(response.status).toBe(200)
        expect(response.icon).toBe(response.body.emoji)
    })

    it('[PUT: /api/v1/phase/disable/:id] Should disable the phase', async () => {
        const req = {
            id: phase_default.id,
            authorization: company_default.id,
        }

        const response = await request(app).put(`/api/v1/phase/disable/${req.id}`).set('authorization', req.authorization)
        expect(response.status).toBe(200)
    })

    it('[POST: /api/v1/phase/] Create the "phase_testOrder1" phase for order test', async () => {

        const new_phase_testOrder1 = {
            name: 'phase-for-order-tests-1',
            department: department_default.id,
            form: false,
        }

        const response1 = await request(app).post('/api/v1/phase').set('authorization', company_default.id).send(new_phase_testOrder1)
        expect(response1.status).toBe(200)

        phase_testOrder1 = response1.body
    })

    it('[POST: /api/v1/phase/] Create the "phase_testOrder2" phase for order test', async () => {

        const new_phase_testOrder2 = {
            name: 'phase-for-order-tests-2',
            department: department_default.id,
            form: false,
        }

        const response2 = await request(app).post('/api/v1/phase').set('authorization', company_default.id).send(new_phase_testOrder2)
        expect(response2.status).toBe(200)

        phase_testOrder2 = response2.body
    })

    it('[POST: /api/v1/phase/] Create the "phase_testOrder3" phase for order test', async () => {

        const new_phase_testOrder3 = {
            name: 'phase-for-order-tests-3',
            department: department_default.id,
            form: false,
        }

        const response3 = await request(app).post('/api/v1/phase').set('authorization', company_default.id).send(new_phase_testOrder3)
        expect(response3.status).toBe(200)

        phase_testOrder3 = response3.body
    })

    //TODO: TEST: Order Phase
    it('[PUT: /api/v1/phase/order/:id] Order Phase', async () => {

        /*
            Os 3 testes a cima, foi criado as phases para serem manipuladas exclusivamente nesse teste.
         */

        expect(true).toBe(false)

    })

})

