module.exports = async function (authorization, department, phase) {
  const FilaController = require("../controllers/FilaController");
  const filaController = new FilaController();

  await  filaController.sendToQueue(
    {
      id: department,
      authorization: authorization,
    },
    "msticket:create_dash"
  );

  await filaController.sendToQueue(
    {
      id: phase,
      authorization: authorization
    },
    "msticket:create_header"
  );
  return true;
};
