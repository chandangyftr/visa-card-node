const redis = require('async-redis');
const client = redis.createClient(6379);

class RedisEngine {
    static expirationTime = 300; //second
    static keyFormat = 'redis.id='; //second


    static async setCache(keyId, data) {
        try {
            var key = this.keyFormat + keyId;
            return await this.set(key, JSON.stringify(data));
        } catch (e) {
            console.log(e);
        }
    }


    static async set(key, data) {
        await client.setex(key, this.expirationTime, data);
    }


    static async getCache(keyId) {
        try {
            var key = this.keyFormat + keyId;
            var data = await this.get(key);
            return JSON.parse(data);
        } catch (e) {
            console.log(e);
        }
    }

    static async get(key) {
        try {
            return await client.get(key);
        } catch (e) {
            console.log(e);
        }
    }


    static async clearCache(keyId) {
        try {
            var key = this.keyFormat + keyId;
            return await this.clear(key);
        } catch (e) {
            console.log(e);
        }
    }

    static async clear(key) {
        try {
            return await client.del(key);
        } catch (e) {
            console.log(e);
        }
    }
}
module.exports = RedisEngine;
