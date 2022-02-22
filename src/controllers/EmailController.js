const moment = require("moment");
const EmailModel = require("../models/EmailModel");

class EmailController {
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
      console.log("Error when check if email created => ", err);
      return err;
    }
  }

  // async incomingEmail(req, res) {
  //     try {
  //         if (!req.body.chat.id)
  //             return res.status(400).send({ error: "There was an error" })

  //         let id_ticket = await emailModel.getByChatId(req.body.chat.id)
  //         if (!id_ticket || id_ticket.length <= 0)
  //             return res.status(400).send({ error: "There was an error" })

  //         let obj = {
  //             "text": req.body.body,
  //             "id_ticket": id_ticket[0].id_ticket,
  //             "id_chat": id_ticket[0].id,
  //             "created_at": moment().format(),
  //             "updated_at": moment().format()
  //         }

  //         let result = await ticketModel.create(obj, "activities_ticket")
  //         if (!result && !result[0])
  //             return res.status(400).send({ error: "There was an error" })

  //         return res.status(200).send("Ok")
  //     } catch (err) {
  //         console.log("Incoming Error =>", err)
  //         return res.status(400).send({ error: "There was an error" })
  //     }
  // }

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

module.exports = EmailController;
