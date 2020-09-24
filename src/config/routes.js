const router = require("express").Router()

router.use("/api/v1/health",(req,res)=> res.status(200).send("Ok!"))
router.use("/api/v1/company",require("../routes/company"))

module.exports = router