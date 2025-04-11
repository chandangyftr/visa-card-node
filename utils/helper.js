const validator = require('validator');
const ORDER_CONSTANTS = {
    WEBSITE_SOURCE: 'WEBSITE',
    WHATSAPP: {
        YES: 'Y',
        NO: 'N'
    },
    PAYU_NOR: '10'
};

const validateOrderInput = (body) => {
    const errors = [];
    
    if (!body.name) {
        errors.push({ field: 'name', message: 'name is required' });
    }

    if (!body.mobile || !validator.isMobilePhone(`${body.mobile}`, 'en-IN')) {
        errors.push({ field: 'mobile', message: 'mobile is invalid' });
    }

    if (body.email && !validator.isEmail(body.email)) {
        errors.push({ field: 'email', message: 'email is invalid' });
    }

    return errors;
};

const getUserIP = (req) => {
    return req.headers['x-forwarded-for'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

const processCartItems = (cartItemIds) => {
    return cartItemIds.length > 0 ? cartItemIds.join(',') : cartItemIds;
};

const processWhatsAppPreference = (whatsApp) => {
    return (!whatsApp || whatsApp === '' || whatsApp === 'N') 
        ? ORDER_CONSTANTS.WHATSAPP.NO 
        : ORDER_CONSTANTS.WHATSAPP.YES;
};

const isValidOrderResult = (orderResult) => {
    return orderResult && !orderResult[0][0].error;
};


const validateDiscountParams = (params) => {
    const errors = [];
    const { categorySlug, limit, fromPrice, toPrice } = params;

    if (categorySlug && typeof categorySlug !== 'string') {
        errors.push('categorySlug must be string.');
    }
    
    if (fromPrice && typeof fromPrice !== 'number') {
        errors.push('fromPrice must be number.');
    }
    
    if (toPrice && typeof toPrice !== 'number') {
        errors.push('toPrice must be number.');
    }
    
    if (limit && typeof limit !== 'number') {
        errors.push('limit must be number.');
    }
    
    if (limit && limit <= 0) {
        errors.push('limit must be greater or equal to 1.');
    }

    return errors;
};



module.exports = {
    validateOrderInput: validateOrderInput,
    getUserIP: getUserIP,
    processCartItems:processCartItems,
    processWhatsAppPreference: processWhatsAppPreference,
    isValidOrderResult: isValidOrderResult,
    validateDiscountParams: validateDiscountParams
};