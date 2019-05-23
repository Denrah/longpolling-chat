'use strict';

var util = require('util');
var events = require('events');
var eventEmitter = new events.EventEmitter();
const mongoUtil = require('../helpers/mongoUtil');
const crypto = require('crypto');
const secret = 'Q2hx#T^4rpA20bF';
const NodeRSA = require('node-rsa');

module.exports = {
    registerUser: registerUser,
    loginUser: loginUser
};

function registerUser(req, res) {
    var user = req.swagger.params.user.value;

    if(!user.name || !user.password)
        req.json('error');

    var pass = crypto.createHmac('sha256', secret)
                   .update(user.password)
                   .digest('hex');
    user.password = pass;
    
    var client = mongoUtil.getDb();

    client.db('lchat').collection('users').findOne({ name: user.name}, (err, doc) => {
        if(err)
            throw err;
        if(doc) {
            res.status(404).json();
            return;
        }
        client.db("lchat").collection("users").insertOne(user, () => {
            res.json("ok");
        });
    });
}

function loginUser(req, res) {
    var user = req.swagger.params.user.value;

    var pass = crypto.createHmac('sha256', secret)
                    .update(user.password)
                    .digest('hex');
    var userKey = user.key;

    var client = mongoUtil.getDb();

    const rsaKey = new NodeRSA({b: 512});
    const publicDer = rsaKey.exportKey('public');
    const privateDer = rsaKey.exportKey('private');

    client.db('lchat').collection('users').findOne({ name: user.name}, (err, doc) => {
        if(err)
            throw err;
        if(!doc) {
            res.status(404).json();
        } else {
            console.log(pass, doc);
            if(doc.password === pass) {
                var token = crypto.createHmac('sha256', secret)
                                .update(user.name + "}uQi2]cV[rHh5H*" + (new Date()).getTime())
                                .digest('hex');

                client.db("lchat").collection("users").updateOne({_id: doc._id}, { $set: {token: token, userKey: userKey, cryptoKey: privateDer}}, (err, doc) => {
                    if (err) throw err;
                    res.json({token: token, key: publicDer});
                });
            }
            else {
                res.status(404).json();
            }
        }
    });
}