module.exports = async function (authorization, department, phase) {
  const FilaController = require("../controllers/FilaController");
  const filaController = new FilaController();

  await new filaController.sendToQueue(
    {
      id: department,
      authorization: authorization,
    },
    "msticket:create_dash"
  );

  await new filaController.sendToQueue(
    {
      id: phase,
      authorization: authorization,
    },
    "msticket:create_header"
  );
  return true;
};
