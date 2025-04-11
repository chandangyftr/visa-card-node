const dotenv = require('dotenv');
dotenv.config();
const secretManager = require('./call');
const { writeLog } = require('./utils/utils');
const sec_man = async () => {
    try {
        let tempdata;
        if (process.env.SECRET_MANAGER == 1) {
            tempdata = await secretManager.getSecret();
        } else {
            tempdata = await secretManager.dummy();
        }
        let MyOpenSecret = JSON.parse(tempdata);
        let secretData = {};
        for (let key in MyOpenSecret) {
            secretData[key] = MyOpenSecret[key];
        }
        process.env.secret = JSON.stringify(secretData);
        require('./app');
    } catch (err) {
        console.log("<=====secret err====>", err);
        writeLog('unhandledRejection', err.stack);
    }
}
sec_man();

process.on('unhandledRejection', (err) => {
    console.log(`Uncaught Exception: ${err.message}`)
    writeLog('unhandledRejection', err.stack);
})