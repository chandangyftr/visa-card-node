
const queryBuilder = require('../../models/queryBuilder');
const {validateCartItem} = require('./validators/cartValidator');

class CartService {
    constructor(db, gyftr) {
        this.db = db;
        this.gyftr = gyftr;
    }

    async clearDirectBuyItems(userId) {
        const queryString = queryBuilder.deleteDirectBuyNowItem();
        await this.db.query(queryString, [userId]);
    }

    async processCartItems(products, userId) {
        const results = [];

        for (const item of products) {
            const cartItem = await this.processCartItem(item, userId);
            results.push(cartItem);
        }

        this.validateResults(results);
        return results;
    }

    async processCartItem(item, userId) {
        validateCartItem(item);

        const sanitizedMobile = item.mobile.substring(item.mobile.length - 10);
        const cartData = {
            userId,
            productId: item.id,
            quantity: item.quantity,
            promo: item.promo || null,
            source: 'WEBSITE',
            name: this.gyftr.dbEncrypt(item.name),
            email: this.gyftr.dbEncrypt(item.email),
            mobile: this.gyftr.dbEncrypt(sanitizedMobile),
            mode: item.mode,
            deliveryDate: item.delivery_date || null
        };

        const result = await this.addToCart(cartData);
        
        if (result[0][0].error) {
            throw new CartError(result[0][0].error);
        }

        return result[0][0].cart_item_id;
    }

    async addToCart(cartData) {
        try{
        const str = queryBuilder.addToCart();
        return await this.db.query(str, Object.values(cartData));
        }catch(err){
            console.log('Error in addToCart',err);
            throw err;
        }
    }

    validateResults(results) {
        const errorItem = results.find(el => el.error || el.hold);
        if (errorItem) {
            throw new CartError(errorItem.error || errorItem.hold);
        }
    }
}

module.exports = CartService;