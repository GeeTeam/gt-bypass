"use strict";

var crypto = require('crypto'),
    request = require('request'),
    pkg = require("../package.json");

var md5 = function (str) {
    return crypto.createHash('md5').update(String(str)).digest('hex');
};

var randint = function (from, to) {
    // range: from ~ to
    return Math.floor(Math.random() * (to - from + 1) + from);
};

function Geetest(config) {

    if (typeof config.geetest_id !== 'string') {
        throw new Error('Geetest ID Required');
    }
    if (typeof config.geetest_key !== 'string') {
        throw new Error("Geetest KEY Required");
    }
    if (typeof config.protocol === 'string') {
        this.PROTOCOL = config.protocol;
    }
    if (typeof config.api_server === 'string') {
        this.API_SERVER = config.api_server;
    }
    if (typeof config.timeout === 'number') {
        this.TIMEOUT = config.timeout;
    }

    this.geetest_id = config.geetest_id;
    this.geetest_key = config.geetest_key;
    this.isFailback = false;
}

Geetest.prototype = {

    PROTOCOL: 'http://',
    API_SERVER: 'api.geetest.com',
    VALIDATE_PATH: '/validate.php',
    REGISTER_PATH: '/register.php',
    TIMEOUT: 2000,
    NEW_CAPTCHA: true,
    JSON_FORMAT: 1,

    register: function (callback, data) {

        var that = this;
        return new Promise(function (resolve, reject) {
            that._register(function (err, data) {
                if (typeof callback === 'function') {
                    callback(err, data);
                }
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            },data);
        });
    },

    _register: function (callback, data) {
        var that = this;
        var query = {
            gt: this.geetest_id,
            json_format: this.JSON_FORMAT,
            sdk: 'Node_' + pkg.version
        }

        if(data){
            query.risk_type = data.risk_type
            if(data.na === true){
                this.API_SERVER = 'api-na.geetest.com'
            } else {
                this.API_SERVER = 'api.geetest.com'
            }
        }


        request({
            url: this.PROTOCOL + this.API_SERVER + this.REGISTER_PATH,
            method: 'GET',
            timeout: this.TIMEOUT,
            json: true,
            qs: query
        }, function (err, res, data) {

            if (err || !data || !data.challenge) {

                // failback
                that.isFailback = true;
                that.challenge = that._make_challenge();
                callback(null, {
                    success: 0,
                    challenge: that.challenge,
                    gt: that.geetest_id,
                    new_captcha: that.NEW_CAPTCHA
                });

            } else {

                that.isFailback = false;
                that.challenge = md5(data.challenge + that.geetest_key);
                callback(null, {
                    success: 1,
                    challenge: that.challenge,
                    gt: that.geetest_id,
                    new_captcha: that.NEW_CAPTCHA
                });
            }
        });
    },

    validate: function (result, callback) {
        var that = this;

        return new Promise(function (resolve, reject) {

            that._validate(result, function (err, data) {
                if (typeof callback === 'function') {
                    callback(err, data);
                }
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        })
    },

    _validate: function (result, callback) {

        var challenge = result.challenge || result.geetest_challenge;
        var validate = result.validate || result.geetest_validate;
        var seccode = result.seccode || result.geetest_seccode;

        if (this.isFailback) {

            if (md5(challenge) === validate) {
                callback(null, true);
            } else {
                callback(null, false);
            }

        } else {

            var hash = this.geetest_key + 'geetest' + challenge;
            if (validate === md5(hash)) {
                request({
                    url: this.PROTOCOL + this.API_SERVER + this.VALIDATE_PATH,
                    method: 'POST',
                    timeout: this.TIMEOUT,
                    json: true,
                    form: {
                        gt: this.geetest_id,
                        seccode: seccode,
                        json_format: this.JSON_FORMAT
                    }
                }, function (err, res, data) {
                    if (err || !data || !data.seccode) {
                        callback(err);
                    } else {
                        callback(null, data.seccode === md5(seccode));
                    }
                });
            } else {
                callback(null, false);
            }
        }
    },

    _make_challenge: function () {
        var rnd1 = randint(0, 90);
        var rnd2 = randint(0, 90);
        var md5_str1 = md5(rnd1);
        var md5_str2 = md5(rnd2);

        return md5_str1 + md5_str2.slice(0, 2);
    },
    /**
     * 校验二次验证的三个参数，校验通过返回true，校验失败返回false
     */
    checkParam(challenge, validate, seccode) {
        return !(challenge == undefined || challenge.trim() === "" || validate == undefined || validate.trim() === "" || seccode == undefined || seccode.trim() === "");
    }
};

module.exports = Geetest;
