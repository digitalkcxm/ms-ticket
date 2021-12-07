const ObjectID = require('mongodb').ObjectID

const collection = 'form_template'
class FormTemplate {
    constructor(db) {
        this._db = db
    }
    async createRegister(column) {
        try {

            const result = await this._db.collection(collection).insertOne({
                column
            })
            return result.insertedId
        } catch (err) {
            console.log("Error when save document => ", err)
            return err
        }
    }

    async findRegistes(id) {
        try {
            id = JSON.parse(id)
            return await this._db.collection(collection).findOne({ "_id": new ObjectID(id) })
        } catch (err) {
            console.log("Error when find register =>", err)
            return err
        }
    }

    async updateRegister(id, obj) {
        try {
            return await this._db.collection(collection).updateOne({ "_id": new ObjectID(id) }, { $set: obj })
        } catch (err) {
            console.log("Error when update register =>", err)
            return err
        }
    }
}

module.exports = FormTemplate