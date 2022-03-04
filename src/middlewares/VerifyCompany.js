import CompanyModel from "../models/CompanyModel.js";

export async function verifyCompany(req, res, next, database, logger) {
  const companyModel = new CompanyModel(database, logger);

  const companyVerified = await companyModel.getByIdActive(
    req.headers.authorization
  );

  if (!companyVerified || companyVerified.length <= 0)
    return res
      .status(400)
      .send({ error: "Please check your company authorization" });

  req.company = companyVerified;
  return next();
}
