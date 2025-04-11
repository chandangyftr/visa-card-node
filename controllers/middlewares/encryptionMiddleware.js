const config = {};
const jsondata = JSON.parse(process.env.secret);
config.get = (arg) => jsondata[arg];
const GyFTR = require('../../utils/encryptionUtility');
const { ENC_KEY, ENC_IV } = config.get('ENCRYPTION');

const gyftr = new GyFTR(ENC_KEY, ENC_IV);

exports.decryptBody = async (req, res, next) => {
  const { encryptedBody } = req.body;
  if (!encryptedBody)
    return res.json({
      code: 400,
      status: 'Error',
      message: '`encryptedBody` key is required'
    });

  const clientDecrypted = gyftr.clientDecrypt(encryptedBody); // encrypted from client side
  const decryptedBody = JSON.parse(clientDecrypted);

  req.body = decryptedBody;
  next();
};

exports.encryptBody = dataToEncrypt => {
  if (!dataToEncrypt) throw new Error('dataToEncrypt is required');
  dataToEncrypt = typeof dataToEncrypt === 'object' ? JSON.stringify(dataToEncrypt) : `${dataToEncrypt}`;
  return gyftr.clientEncrypt(dataToEncrypt);
};

exports.decryptFields = dataObj => {
  const piFields = [
    'name',
    'phone',
    'email',
    'gender',
    'dob',
    'gst',
    'address',
    'anniversary_date',
    'delivery_name',
    'delivery_email',
    'delivery_phone',
    'delivery_sender_name',
    'cart_delivery_name',
    'cart_delivery_email',
    'cart_delivery_phone',
    'promocode'
  ];
  for (const ind in dataObj) {
    if (piFields.includes(ind)) {
      const el = dataObj[ind];
      if (el && el.includes('=')) {
        const decrypted = gyftr.dbDecrypt(el);
        dataObj[ind] = decrypted;
      }
    }
  }
  return dataObj;
};

exports.decryptField = dataObj => {
  const piFields = [
    'name',
    'phone',
    'email',
    'gender',
    'dob',
    'anniversary_date',
    'delivery_name',
    'delivery_email',
    'delivery_phone',
    'delivery_sender_name',
    'cart_delivery_name',
    'cart_delivery_email',
    'cart_delivery_phone',
    'promocode'
  ];
  for (const ind in dataObj) {
    if (piFields.includes(ind)) {
      const el = dataObj[ind];
      if (el && el.includes('=')) {
        const decrypted = gyftr.dbDecrypt(el);
        dataObj[ind] = decrypted;
      }
    }
  }
  return dataObj;
};
/**
 * @description: The below two request handlers are solely for experimental
 * purposes. these can be used to test the encrypted body and decrypted body.
 */
exports.encryptHandler = async (req, res, next) => {
  try {
    const clientEncrypted = gyftr.clientEncrypt(JSON.stringify(req.body));
    res.json({ encryptedBody: clientEncrypted });
  } catch (err) {
    console.log("encryptHandler",err);
    throw err;
  }
};

exports.decryptHandler = async (req, res, next) => {
  try {
    const { encryptedBody } = req.body;
    if (!encryptedBody)
      return res.json({
        code: 400,
        status: 'Error',
        message: '`encryptedBody` key is required'
      });

    const clientDecrypted = gyftr.clientDecrypt(encryptedBody);

    const decryptedBody = JSON.parse(clientDecrypted);
    res.status(200).json({ decryptedBody });
  } catch (err) {
    console.log("decryptHandler",err);
    throw err;
  }
};
exports.encryptedKey = async (req, res, next) => {
  try {
    let data = gyftr.dbEncrypt(req.body.data)
    return res.json({ data: data });
  } catch (err) {
    console.log("encryptedKey",err);
    throw err;
  }
};


exports.decryptedKey = async (req, res, next) => {
  try {
    let data = gyftr.dbDecrypt(req.body.data)
    return res.json({ data: data });
  } catch (err) {
    console.log("decryptedKey",err);
    throw err;
  }
};