import request from 'supertest'
import { app } from '../../src/config/server.js'
import database from '../../src/config/database/database.js'
import logger from "../../src/config/logger.js";
import DepartmentModel from '../../src/models/DepartmentModel.js'
import DepartmentController from "../../src/controllers/DepartmentController.js";

describe('Department integration test', () => {

    const departmentModel = new DepartmentModel(database, logger)
    const departmentController = new DepartmentController(database, logger)

    // COMPANY MODEL USED FOR TESTS
    let defaultCompany = {
        id: "Empty",
        name: "Default Company 1 Used in Department tests",
        callback: "http://dc1:5016/api/v1/ticket/callback",
        active: "true",
        notify_token: "2as41bh2tmklii3jnfpcvlnmsdgfh00sndkldwdfs"
    }

    // DEPARTMENT MODEL
    let department_test = {
        id: "empty",
        id_company: defaultCompany.id,
        id_department_core: 1,
    }

    beforeAll(async () => {
        // Cria a company para usar no departamento
        const companyCreationRequest1 = await request(app).post('/api/v1/company').send(defaultCompany)
        defaultCompany = companyCreationRequest1.body;
    })




    // CREATE DEPARTMENT TEST ======================================================================================
    it('Should create a department', async () => {
        const newDepartment = {
            id_company: defaultCompany.id,
            id_department_core: 1,
        }

        const response = await departmentModel.create(newDepartment)
        expect(response[0]).toHaveProperty('id')
        department_test.id = response[0].id
    })

    it('Should validate the created department', async () => {
        const response = await departmentController.checkDepartmentCreated(department_test.id_department_core, defaultCompany.id)

        expect(response[0]).toHaveProperty('id')
        expect(response[0].id).toBe(department_test.id)
    })

    it('Should create a department if does`t exists', async () => {
        const response = await departmentController.checkDepartmentCreated(18, defaultCompany.id)

        expect(response[0]).toHaveProperty('id')
        expect(response.id).not.toBe(department_test.id)
    })

    it('Should not create a department using the "checkDepartmentCreated" method with invalid "company_id"', async () => {
        const response = await departmentController.checkDepartmentCreated(19, 999)
        expect(response).not.toHaveProperty('id')
    })

    it('Should not create a department with invalid id_company key', async () => {
        const invalidtDepartment = {
            id_company: 99999,
            id_department_core: 1,
        }

        const response = await departmentModel.create(invalidtDepartment)
        expect(response).not.toHaveProperty('id')
    })

    // GETTER DEPARTMENT TEST =================================================================================
    it('Get a department by (id_department_core, company_id)', async () => {
        const response = await departmentModel.getByID(department_test.id_department_core, defaultCompany.id)

        expect(response[0]).toHaveProperty('id')
        expect(response[0].id).toBe(department_test.id)
    })


    it('Get a department by IDCompany and expect all the properties', async () => {
        const response = await departmentModel.getByIDCompany(defaultCompany.id)

        expect(response[0]).toHaveProperty('id')
        expect(response[0]).toHaveProperty('id_department_core')
        expect(response[0].id).toBe(department_test.id)
        expect(response[0].id_department_core).toBe(department_test.id_department_core)
    })

})