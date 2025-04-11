const seamLessPgService = require('./seamLessPgService.js');
const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const DB = require('../../models/DbQuery');
const db = new DB(config.get('db'));

const REFUND_STATUS = {
    SUCCESS: 'success',
    FAILED: 'failed',
    ALREADY_INITIATED: 'already initiated'
};

const REFUND_CODES = {
    COMPLETED: 'R',
    FAILED: 'RF'
};

class RefundService {
    static async validateWalletEarnRefund(orderId) {
        const query = `SELECT auto_refund_walletAndEarn_status(?) AS STATUS`;
        const [result] = await db.query(query, [orderId]);
        return result.STATUS;
    }

    static getPointRefundMessage(status) {
        return status === 0
            ? 'Not eligible, please complete refund for Wallet or Earn point.'
            : 'Refund not eligible for some reason';
    }

    static async processSeamlessRefund(refundData, payunor) {
        try {
            const encryptedData = await seamLessPgService.clientEncrypt(
                JSON.stringify({
                    externalOrderid: refundData.txn_guid,
                    refund_order_id: refundData.refund_txn_guid,
                    amount: refundData.amount
                })
            );

            const refundStatus = await seamLessPgService.refundStatus(encryptedData, payunor);
            const refundStatusParsed = JSON.parse(refundStatus);

            if (refundStatusParsed.status === REFUND_STATUS.FAILED) {
                return await this.initiateRefund(encryptedData, payunor, refundData);
            }

            return {
                txnId: refundData.refund_txn_guid,
                txnStatus: REFUND_STATUS.ALREADY_INITIATED,
                txnresp: refundStatusParsed
            };
        } catch (err) {
            console.log('Error in seamless refund', err);
            throw err;
        }
    }

    static async initiateRefund(encryptedData, payunor, refundData) {
        try{
        const refundResponse = await seamLessPgService.refund(encryptedData, payunor, refundData);
        const parsedResponse = JSON.parse(refundResponse);

        return await this.updateRefundStatus(parsedResponse, refundData, refundResponse);
        
        }catch(err){
            console.log('Error in seamless initiateRefund', err);
            throw err;
        }
    }

    static async updateRefundStatus(parsedResponse, refundData, rawResponse) {
        const status = parsedResponse.status === REFUND_STATUS.SUCCESS ?
            REFUND_CODES.COMPLETED : REFUND_CODES.FAILED;

        const mihpayid = parsedResponse.status === REFUND_STATUS.SUCCESS ?
            parsedResponse.response.mihpayid : null;

        const orderUpdateQuery = await db.query(
            'CALL auto_order_refund_update(?, ?, ?, ?, ?, ?, ?)',
            [
                'PG',
                refundData.order_id,
                refundData.refund_txn_id,
                status,
                rawResponse,
                parsedResponse.message,
                mihpayid
            ]
        );

        return {
            txnId: refundData.refund_txn_guid,
            txnStatus: parsedResponse.status,
            txnresp: parsedResponse,
            dbupdate: orderUpdateQuery[0]
        };
    }
}

module.exports = RefundService;
