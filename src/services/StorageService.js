import fs from 'fs'
import dotenv from 'dotenv'
import { PutObjectCommand } from '@aws-sdk/client-s3'

import S3 from '../config/s3.js'

dotenv.config()

export default class StorageService {
    async upload(
        dirBucket,
        dirFile,
        fileName,
        contentType,
        publicAccess = false,
        bucketName = process.env.BUCKET,
        region = 'sa-east-1',
        projectName = 'msticket'
    ) {
        return new Promise((resolve, reject) => {
            const s3 = S3.newInstance(region)

            const fileKey = projectName ? `${projectName}/${dirBucket}/${fileName}` : `${dirBucket}/${fileName}`

            const params = {
                Bucket: bucketName,
                Key: fileKey,
                Body: fs.createReadStream(dirFile),
                ACL: publicAccess ? 'public-read' : 'private',
                ContentType: contentType
            }

            contentType ? (params.ContentType = contentType) : ''

            const url =
                region === 'us-east-1'
                    ? `https://${bucketName}.s3.amazonaws.com/${fileKey}`
                    : `https://s3.${region}.amazonaws.com/${bucketName}/${fileKey}`

            setTimeout(() => {
                s3.send(new PutObjectCommand(params))
                    .then(() => {
                        fs.unlinkSync(dirFile)
                        resolve(url)
                    })
                    .catch((err) => {
                        console.error(err)
                        reject(err)
                    })
            }, 2000)
        })
    }

    async uploadBase64(
        dirBucket,
        dirFile,
        fileName,
        contentType = 'text/txt',
        publicAccess = false,
        bucketName = process.env.BUCKET,
        region = 'sa-east-1'
    ) {
        const path = `/tmp/${fileName}`
        await new Promise((resolve, reject) => {
            fs.writeFile(path, dirFile, 'base64', function (err) {
                if (err) reject(err)
                resolve()
            })
        })

        return this.upload(dirBucket, path, fileName, contentType, publicAccess, bucketName, region, 'msticket')
    }
}