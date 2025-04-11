const config = {}; 
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg]; 
const DB = require('../../models/DbQuery');
const queryBuilder = require('../../models/queryBuilder');
const db = new DB(config.get('db'));
const CommEngine = require('./CommEngine');

class TransactionService {
    static async handleSuccessfulTransaction(transactionDetail, userId, txnId, payuDetails) {
        
        const [txn] = await this.changeTxnStatus(
            userId,
            txnId,
            'C',
            JSON.stringify(transactionDetail),
            transactionDetail.pgTransactionId || '',
            payuDetails
        );

        if (txn[0].order_guid) {
            console.log('order_guid',txn[0].order_guid);
            const resdata = await CommEngine.sendVoucherBulk(txn[0].order_guid);
            console.log('resdata',resdata);
        }

        return txn[0];
    }

    static async handleFailedTransaction(userId, txnId, transactionDetail, payuDetails) {
        const [txn] = await this.changeTxnStatus(
            userId,
            txnId,
            'F',
            JSON.stringify(transactionDetail),
            transactionDetail?.pgTransactionId || '',
            payuDetails
        );

        return txn[0];
    }

    static getPgIdentifier(transactionDetail) {
        return transactionDetail?.response?.paymentDetails?.pgIdentifier === "PayU" 
            ? "SEAMLESSPG" 
            : transactionDetail?.response?.paymentDetails?.pgIdentifier;
    }

    static async changeTxnStatus(
        userId,
        txnId,
        status,
        desc,
        mihpayid,
        payuDetails
    ) {
        try {
            desc = desc ? desc : null;
            mihpayid = mihpayid ? mihpayid : null;
    
            let { mode = null, pg_type, card_num, name_on_card, discount, remark, auth_code } = payuDetails;
    
            const queryStr = queryBuilder.changeTxnStatus();
    
            return await db.query(queryStr, [
                userId,
                txnId,
                status,
                desc,
                mihpayid,
                discount,
                remark,
                mode,
                pg_type,
                card_num,
                name_on_card,
                auth_code
            ]
            );
            
        } catch (err) {
            console.log("changeTxnStatus Error", err);
            throw err;
        }
    }
}

module.exports = TransactionService;
