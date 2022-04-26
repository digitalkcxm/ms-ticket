import moment from "moment";
import EmailModel from "../models/EmailModel";

export default class EmailController {
  constructor(database = {}, logger = {}) {
    
    this.logger = logger;
    this.emailModel = new EmailModel(database, logger);
  }
  async checkEmailCreated(email, company_id) {
    try {
      let result = await this.emailModel.getEmailByEmail(email, company_id);
      if (!result || result.length <= 0)
        result = await this.emailModel.createEmail({
          id_company: company_id,
          email: email,
          created_at: moment().format(),
          updated_at: moment().format(),
        });

      return result[0];
    } catch (err) {
      this.logger.error(err, "Error when check if email created.");
      return err;
    }
  }

  async formatEmail(
    created_at,
    sla,
    id_ticket,
    userName,
    phase,
    texto,
    id_unit_of_time
  ) {
    let timeExpired;
    switch (id_unit_of_time) {
      case 1:
        timeExpired = moment(created_at).add(sla, "seconds");
        break;
      case 2:
        timeExpired = moment(created_at).add(sla, "minutes");
        break;
      case 3:
        timeExpired = moment(created_at).add(sla, "hours");
        break;
      case 4:
        timeExpired = moment(created_at).add(sla, "days");
        break;
      default:
        timeExpired = moment(created_at).add(sla, "hours");
        break;
    }
    let dateExpired = moment(timeExpired).format("DD/MM/YYYY");
    let hourExpired = moment(timeExpired).format("HH:mm:ss");

    return `
<html>
    <head>
        <title></title>
    </head>
    <body>
        <p>Olá, foi aberto o ticket <strong>#${id_ticket}</strong> dia <strong>${moment(
      created_at
    ).format("DD/MM/YYYY")}</strong> às <strong>${moment(created_at).format(
      "HH:mm:ss"
    )}</strong> por
            <strong>${userName}</strong> 
        <p>
        <br><br>
        <p><strong>Fase</strong> : ${phase}</p>
        ${texto}

        <br>
        <p>Acesse pshomol.digitalk.com.br no módulo de Backoffice e realize a tratativa desse ticket antes de <strong>${dateExpired}</strong> às
            ${hourExpired} para garantir o nível de serviço contratado.
        </p>
        <br>
        <p>Caso tenha interesse em registrar um histórico a esse Ticket, também poderá incluir abaixo, após a linha
            informada.
        </p>

        <br><br>
        <p>==========================================================================</p>
        <p> PARA REGISTRAR UMA OCORRÊNCIA AO TICKET, ESCREVA ABAIXO DESSA LINHA E NÃO MODIFIQUE O TÍTULO. PARA FINALIZAR O
            TICKET, ENVIE APENAS 'FINALIZAR'
        </p>
        <p> ==========================================================================</p>

    </body>
</html>`;
  }
}
