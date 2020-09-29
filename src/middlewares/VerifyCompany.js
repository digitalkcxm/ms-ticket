const CompanyModel = require("../models/CompanyModel")

const companyModel = new CompanyModel()

async function verifyCompany(req, res, next) {
    const companyVerified = await companyModel.getById(req.headers.authorization)
    if (!companyVerified || companyVerified.length <= 0)
        return res.status(400).send({ error: "Please check your company authorization" })

    req.company = companyVerified
    return next()
}

module.exports = { verifyCompany }