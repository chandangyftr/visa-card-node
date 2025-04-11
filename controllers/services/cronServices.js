const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const chalk = require('chalk');
const DB = require('../../models/DbQuery');
const { writeLog } = require('../../utils/logger');
const queryBuilder = require('../../models/queryBuilder');
const CommEngine = require('./CommEngine');
const db = new DB(config.get('db'));
const { createSuccessResponse, sendServerError } = require('../../utils/api/responseBuilder');
const seamLessPgService = require('../../controllers/services/seamLessPgService.js');

const RefundService = require('./refundService.js');

exports.sendVoucher = async (req, res, next) => {
    try {

        var guid = req.params.ordernumber && req.params.ordernumber != 'all' ? req.params.ordernumber : null;

        const queryStr = queryBuilder.verifying_orders();

        const [verifyingOrders] = await db.query(queryStr, [guid]);

        // Hit the sendVoucher in loop
        const orderDeliveryStatus = [];
        let i = 0;
        for (const vfOrder of verifyingOrders) {
            i++;
            // if (i === 2) break;
            const deliveryStatus = await CommEngine.sendVoucher(vfOrder.order_guid);
            orderDeliveryStatus.push({
                order_guid: vfOrder.order_guid,
                deliveryStatus
            });
        }

        res.status(200).json({
            status: 'success',
            total: verifyingOrders.length,
            results: orderDeliveryStatus.length,
            data: orderDeliveryStatus
        });
    } catch (err) {
        console.log('sendVoucher Err', err);
        writeLog('app', JSON.stringify(err));
        res.status(500).json({
            error: err.name,
            message: err.message,
            errStack: err.stack
        });
    }
};

async function OrderDetailsByTxnGuid(txn_guid) {
    try {
        const query = queryBuilder.orderDtlsByTxnGuid();
        return await db.query(query, [`${txn_guid}`]);
    } catch (err) {
        console.log("OrderDetailsByTxnGuid Error",err);
        throw err;
    }
}

async function isOrderProcess(txnId) {
    try {
        var str = queryBuilder.isOrderProcess();
        var [isOrderProcessResult] = await db.query(str, [txnId]);
        if (isOrderProcessResult[0] && isOrderProcessResult[0].error_status && isOrderProcessResult[0].error_status == '1') {
            return true;
        }
        return false;
    } catch (err) {
        console.log("isOrderProcess Error",err);
        throw err;
    }
}

async function changeTxnStatus(
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
        ]);

    } catch (err) {
        console.log("changeTxnStatus Error",err);
        throw err;
    }
}

exports.autoCompleteOrders = async (req, res, next) => {

    try {

        let queryStr = `CALL automate_order_status_update();`
        const completedOrders = await db.query(queryStr);

        if (_.isEmpty(completedOrders[0])) return next(new AppError(400, 'Data not found'));

        if (completedOrders.length > 0) {
            const response = createSuccessResponse('', 'Orders Updated');
            res.status(200).json(response);
        }

    } catch (err) {
        console.error(chalk.bold.bgMagenta('AUTO_COMPLETED_ORDERS_ERR:'), err);
        sendServerError(res, 'Error Auto Completed Orders');
    }

}



exports.walletPointrefund = async (req, res, userData, order_guid, client_id, redirect = 'Y') => {

    var user_id = userData.user_id;

    var queryStr = queryBuilder.walletRefund();

    var result = await db.query(queryStr, [order_guid]);

    writeLog("dell", JSON.stringify(result));

    if (result) {

        writeLog("dell", JSON.stringify(result[0][0]));
        for (var key in result[0]) {

            queryStr = queryBuilder.reverseWalletDebitTransaction();

            await db.query(queryStr, [user_id, result[0][key].unique_id, result[0][key].id, client_id]);

        }
    }
};


exports.checkTransactionStatusPgSeamless = async (req, res, next) => {

    try {

        var guid = (req.params.ordernumber && req.params.ordernumber != 'all') ? req.params.ordernumber : null;

        console.log('Guid ---------->', guid);

        const results = [];

        var queryStr = queryBuilder.allOrderPendingSeamlessPg();

        const [pendingTxns] = await db.query(queryStr, [guid]);

        if (pendingTxns.length < 1) {
            return res.json({
                status: 'success',
                statusCode: 200,
                message: 'No Pending TXNs',
                total: results.length,
                data: results
            });
        }


        // 2. HIT in Loop and call the paymentStatusCheck() function
        for (const txn of pendingTxns) {
            var payuResponse = {};
            payuResponse.txnid = txn.guid;

            //  check if Order has already been processed : do nothing
            const payunordata = await getTransactionDetails(txn.guid);
            payuResponse.payunor = payunordata.payunor;

            const isNewOrderProcess = await isOrderProcess(txn.guid);
            console.log('isNewOrderProcess ------------------>', isNewOrderProcess);

            var getTransactionDetail = await seamLessPgService.getTransactionStatus(txn.guid);
            getTransactionDetail = JSON.parse(getTransactionDetail);

            const payuDetails = extractPayuDetails(transactionDetail);


            if (getTransactionDetail && getTransactionDetail.status) {
                var transactionDetail = getTransactionDetail?.response?.paymentDetails;
                if (transactionDetail && transactionDetail.transactionStatus == 'success') {

                    const successRes = await handleSuccessfulTransaction(txn, transactionDetail, payuDetails);

                    results.push(successRes);

                } else if (!transactionDetail || (transactionDetail.transactionStatus == 'failed')) {
                    const failRes = await handleFailedTransaction(txn, transactionDetail, payuDetails);

                    results.push(failRes);

                }
            }

        }

        return res.json({
            status: 'success',
            statusCode: 200,
            message: 'Payment TXNs Updated',
            total: results.length,
            data: results
        });

    } catch (err) {
        console.error(chalk.bold.bgMagenta('CHECK_TRANSACTION_STATUS_ERR:'), err);
        sendServerError(res, 'Error Check Transaction Status');
    }
}


function extractPayuDetails(transactionDetail) {
    return {
        discount: 0,
        remark: transactionDetail.remark || null,
        mode: transactionDetail.mode || null,
        pg_type: transactionDetail?.response?.paymentDetails?.pg_type || null,
        card_num: transactionDetail?.response?.paymentDetails?.card_no || null,
        name_on_card: transactionDetail?.response?.paymentDetails?.name_on_card || null,
        auth_code: transactionDetail?.response?.paymentDetails?.auth_code || null
    };
}

async function getTransactionDetails(guid) {
    const [orderDetails] = await OrderDetailsByTxnGuid(guid);
    return {
        payunor: orderDetails?.[0]?.payunor || 0
    };
}

async function handleSuccessfulTransaction(txn, transactionDetail, payuDetails) {
    const pgIdentifier = determinePgIdentifier(transactionDetail);
    await updatePgIdentifier(txn.guid, pgIdentifier,txn.source);

    const [completedTXN] = await changeTxnStatus(
        txn.user_id,
        txn.guid,
        'C',
        JSON.stringify(transactionDetail),
        transactionDetail?.response?.paymentDetails?.pgTransactionId || '',
        payuDetails
    );

    const txnStatus = {
        txn_guid: txn.guid,
        user_id: txn.user_id,
        txn_status: 'SUCCESS'
    };

    if (completedTXN[0]?.order_guid) {
        await CommEngine.sendVoucherBulk(completedTXN[0].order_guid);
        txnStatus.deliveryStatus = 'DELIVERED';
    }

    return txnStatus;
}

function determinePgIdentifier(transactionDetail) {
    return transactionDetail?.response?.paymentDetails?.pgIdentifier === "PayU" 
        ? "SEAMLESSPG" 
        : transactionDetail?.response?.paymentDetails?.pgIdentifier;
}

async function updatePgIdentifier(txnId, pgIdentifier, userSource) {
    if (pgIdentifier !== userSource) {
        await db.query(
            "UPDATE transactions SET source = ? WHERE guid = ?",
            [pgIdentifier, txnId]
        );
    }
}

async function handleFailedTransaction(txn, transactionDetail, payuDetails) {
    await changeTxnStatus(
        txn.user_id,
        txn.guid,
        'F',
        JSON.stringify(transactionDetail),
        transactionDetail?.response?.paymentDetails?.pgTransactionId || '',
        payuDetails
    );

    return {
        txn_guid: txn.guid,
        user_id: txn.user_id,
        txn_status: 'FAIL'
    };
}


exports.refundPgSeamless = async (req, res) => {
    try {
        const { order_guid } = req.params;

        // Get refund records
        const [refundRecords] = await db.query(
            'CALL auto_refund_order_transaction(?, ?)',
            [order_guid !== 'all' ? order_guid : null, 'PG']
        );

        if (!refundRecords?.length) {
            return res.status(400).json({
                code: 400,
                message: 'Record Not Found!',
                status: 'Error'
            });
        }

        const refundResults = await processRefunds(refundRecords);

        const respdata = createSuccessResponse(
            {
                refundTxnStatus: refundResults.map(({ txnId, txnStatus, dbupdate }) =>
                    ({ txnId, txnStatus, dbupdate }))
            },
            'Refund Status'
        );

        // Log the complete response including detailed information
        writeLog('refund', JSON.stringify({
            param: req.params,
            data: refundResults
        }));

        return res.json(respdata);

    } catch (error) {
        console.error('Error in refund Pg Seamless ----->', error);
        writeLog('refund', JSON.stringify({
            params: req.params,
            error: error.message
        }));

        return res.status(500).json({
            code: 500,
            error: '',
            message: 'Something went wrong!',
            status: 'Error'
        });
    }
};

async function processRefunds(refundRecords) {
    const refundResults = [];

    for (const record of refundRecords) {
        const walletEarnStatus = await RefundService.validateWalletEarnRefund(record.order_id);

        if (walletEarnStatus !== 1) {
            refundResults.push({
                txnId: record.refund_txn_guid,
                txnStatus: RefundService.getPointRefundMessage(walletEarnStatus)
            });
            continue;
        }

        if (record.source === 'SEAMLESSPG') {
            const result = await RefundService.processSeamlessRefund(record, record.payunor);
            refundResults.push(result);
        }
    }

    return refundResults;
}


exports.sendVoucherBulk = async (req, res, next) => {
    try {

        var guid = req.params.ordernumber && req.params.ordernumber != 'all' ? req.params.ordernumber : null;

        const queryStr = queryBuilder.verifying_orders();

        const [verifyingOrders] = await db.query(queryStr, [guid]);

        // Hit the sendVoucher in loop
        const orderDeliveryStatus = [];
        let i = 0;
        for (const vfOrder of verifyingOrders) {
            i++;
            // if (i === 2) break;
            const deliveryStatus = await CommEngine.sendVoucherBulk(vfOrder.order_guid);
            orderDeliveryStatus.push({
                order_guid: vfOrder.order_guid,
                deliveryStatus
            });
        }

        res.status(200).json({
            status: 'success',
            total: verifyingOrders.length,
            results: orderDeliveryStatus.length,
            data: orderDeliveryStatus
        });
    } catch (err) {
        console.log('Err in send Voucher Bulk ------->', err);
        writeLog('app', JSON.stringify(err));
        res.status(500).json({
            error: err.name,
            message: err.message,
            errStack: err.stack
        });
    }
};

