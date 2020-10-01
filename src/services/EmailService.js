const axios = require('axios')

class EmailService {
    async sendMenssage(chatId, protocolInfo, message, type, emailCopy, attachments, emailReply, emailForward) {
        let data = null
        try {
            if (type === 'text') {
                data = {
                    chatId,
                    body: message,
                    subject: `Protocolo ${protocolInfo.protocol_id}`,
                    replyTo: (emailReply && emailReply.replyTo) ? emailReply.replyTo : false,
                    replyAll: (emailReply && emailReply.replyAll) ? emailReply.replyAll : false,
                    forward: (emailForward && emailForward.forward) ? emailForward.forward : null
                }
            } else {
                data = {
                    chatId,
                    body: (message) ? message : ' ',
                    subject: `Protocolo ${protocolInfo.protocol_id}`,
                    attachments,
                    replyTo: (emailReply && emailReply.replyTo) ? emailReply.replyTo : false,
                    replyAll: false,
                    forward: (emailForward && emailForward.forward) ? emailForward.forward : null
                }
            }

            if (emailCopy) {
                data.cc = emailCopy.cc
                data.bcc = emailCopy.bcc
            }

            if (data.forward && emailForward.messages) {
                const messageHistory = await this._getMessageForward(emailForward.messages, protocolInfo.protocol_id)
                data.body = (data.body) ? `${data.body}<br>${messageHistory}` : messageHistory
            }

            console.log(JSON.stringify(data))

            const instance = await this._instance(protocolInfo.protocol_department_id)
            return await instance.post(`/api/v1/messages/outgoing`, data)
        } catch (err) {
            return { error: "Erro ao enviar a mensagem." }
        }
    }

    //   async _getMessageForward(listIdMessage, protocolId) {
    //     let message = '';
    //     try {
    //       let listMessages = await Promise.all(listIdMessage.map(async m => await messageModel.getMessageByIdAndProtocol(m.id, protocolId)))
    //       listMessages.forEach(m => {
    //         message += `--------- Mensagem Encaminhada ------<br>${m[0].message}<br>`
    //       })
    //       return message
    //     } catch (err) {

    //       return { error: "Erro ao recuperar a mensagem." }
    //     }
    //   }

    async sendActiveMenssage(subject, destination, message) {
        // try {
        //     let data = {
        //         destination,
        //         subject,
        //         body: message
        //     }

        //     const instance = await this._instance()
        //     return await instance.post(`/api/v1/messages/outgoing-active`, data)
        // } catch (err) {
        //     console.log(err)
        //     return { error: "Erro ao recuperar a mensagem." }
        // }
    }

    async closedChat(chat_id, department) {
        try {
            const instance = await this._instance(department)
            return await instance.put(`/api/v1/protocols/close`, { protocolId: chat_id })
        } catch (err) {
            await monitoringService(`${classe}-closedChat`, 1, err.message, 2)

            return { error: "Erro ao fechar o chat." }
        }
    }


    async _createInstance(settings) {
        if (settings && settings.length > 0)
            return axios.create({
                baseURL: process.env.EMAILSES,
                timeout: 180000,
                headers: {
                    'Content-Type': 'application/json',
                    'token': settings[0].settings.token
                }
            })
        else return null
    }

    async _instance() {
        try {
            return axios.create({
                baseURL: process.env.EMAILSES,
                timeout: 180000,
                headers: {
                    'Content-Type': 'application/json',
                    'token': process.env.EMAILTOKEN
                }
            })
        } catch (err) {
            return err
        }
    }
}

module.exports = EmailService
