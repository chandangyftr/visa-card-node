const validator = require('validator');
const _ = require('lodash');

exports.validateProducts = (products) => {
    if (!products) {
        return {
            isValid: false,
            error: 'products are required'
        };
    }

    if (_.isEmpty(products)) {
        return {
            isValid: false,
            error: 'products cannot be empty'
        };
    }

    return { isValid: true };
};

exports.validateCartItem = (item) => {
    const validations = [
        {
            condition: !item.mobile || !validator.isMobilePhone(`${item.mobile}`, 'en-IN'),
            error: 'INVALID_PHONE'
        },
        {
            condition: !item.email || !validator.isEmail(item.email),
            error: 'INVALID_EMAIL'
        },
        {
            condition: !item.quantity || typeof item.quantity !== 'number',
            error: 'INVALID_QUANTITY'
        },
        {
            condition: !item.id || typeof item.id !== 'number',
            error: 'INVALID_PRODUCT_ID'
        },
        {
            condition: !item.quantity || item.quantity > 10 || item.quantity < 0,
            error: 'INVALID_QUANTITY'
        },
        {
            condition: !item.name || typeof item.name !== 'string',
            error: 'INVALID_NAME'
        }
    ];

    const error = validations.find(v => v.condition);
    if (error) {
        throw new CartError(error.error);
    }

    return true;
};