const seamLessPgService = require('./seamLessPgService.js');
const config = {}; 
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg]; 
const DB = require('../../models/DbQuery');
const queryBuilder = require('../../models/queryBuilder');
const db = new DB(config.get('db'));
const _ = require('lodash');

class PaymentService {
    static async processDecryptedData(encryptedData) {
        const decryptedData = await seamLessPgService.clientDecrypt(encryptedData);
        return JSON.parse(decryptedData);
    }

    static async getUserDetails(txnId) {
        const userDtlsQuery = queryBuilder.userDtlsByTxnId();
        const [userDtls] = await db.query(userDtlsQuery, [txnId]);
        
        if (_.isEmpty(userDtls)) {
            throw new Error('Invalid request 2');
        }
        
        return userDtls[0];
    }

    static async getTransactionDetails(txnId) {
        const transactionDetail = await seamLessPgService.getTransactionStatus(txnId);
        return JSON.parse(transactionDetail);
    }

    static formatPayuDetails(transactionData) {
        return {
            discount: 0,
            remark: transactionData.remark || null,
            mode: transactionData.mode || null,
            pg_type: transactionData?.response?.paymentDetails?.pg_type || null,
            card_num: transactionData?.response?.paymentDetails?.card_no || null,
            name_on_card: transactionData?.response?.paymentDetails?.name_on_card || null,
            auth_code: transactionData?.response?.paymentDetails?.auth_code || null
        };
    }

    static async updatePgIdentifier(txnId, pgIdentifier, userSource) {
        if (pgIdentifier !== userSource) {
            await db.query(
                "UPDATE transactions SET source = ? WHERE guid = ?",
                [pgIdentifier, txnId]
            );
        }
    }

    static getRedirectUrl(orderGuid) {
        return config.get('site').base_url + 'payment/' + orderGuid;
    }
}

module.exports = PaymentService;