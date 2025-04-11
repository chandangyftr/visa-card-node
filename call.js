var AWS = require('aws-sdk'),
    region = "ap-south-1",
    secretName="visa-card-node";

class SecretsManager {

    /**
     * Uses AWS Secrets Manager to retrieve a secret
     */

    static dummy(){
        let dataa = require('./config/default-test.json');
        dataa = JSON.stringify(dataa);
        return new Promise((res, rej) => {
            setTimeout(() => {
                res(dataa);
            },2000)
        })
    }
 

    static async getSecret (){
        return new Promise((resolve, reject) => {
        const secretsManager = new AWS.SecretsManager({region});
      
            secretsManager.getSecretValue({SecretId: secretName}, (err, data) => {
                const rejectOn = [
                    'DecryptionFailureException',
                    'InternalServiceErrorException',
                    'InvalidParameterException',
                    'InvalidRequestException',
                    'ResourceNotFoundException'
                ] 
                if(err && rejectOn.indexOf(err.code)) reject(err)
                resolve(data?.SecretString)
            }) 
           
        
    })
    } 
}
module.exports = SecretsManager;