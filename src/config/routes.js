const router = require("express").Router()

router.use("/api/v1/health",(req,res)=> res.status(200).send("Ok!"))
router.use("/api/v1/company",require("../routes/company"))
router.use("/api/v1/phase", require("../routes/phase"))

module.exports = router