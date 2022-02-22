import FilaController from "../controllers/FilaController.js";
export default async function (
  authorization,
  department,
  phase,
  logger,
  database
) {
  const filaController = new FilaController(logger, database);
  await filaController.sendToQueue(
    {
      id: department,
      authorization: authorization,
    },
    "msticket:create_dash"
  );

  await filaController.sendToQueue(
    {
      id: phase,
      authorization: authorization,
    },
    "msticket:create_header"
  );
  return true;
}
