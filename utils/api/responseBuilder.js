const _ = require('lodash');

const createSuccessResponse = (data, message = '', additionalKeys={}) => {
  const response = {
    code   : 200,
    status : 'SUCCESS',
    error  : '',
    message ,
    data : data ? data : []
  };
  if (additionalKeys && !_.isEmpty(additionalKeys)) {
    const keys = Object.keys(additionalKeys);
    const values = Object.values(additionalKeys);
    keys.forEach((key, ind) => (response[key] = values[ind]));
  }
  return response;
};

const createErrResponse = (code, message = '', err = '') => {
  return {
    code,
    status: 'Error',
    error: err,
    message
  };
};

const sendServerError = (res, errType = '') => {
  const errResp = createErrResponse(500, 'Something went wrong', errType);
  res.status(500).json(errResp);
};

module.exports = { createErrResponse, createSuccessResponse, sendServerError };
