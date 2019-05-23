'use strict';

var util = require('util');
var events = require('events');
var eventEmitter = new events.EventEmitter();
const mongoUtil = require('../helpers/mongoUtil');
var fs = require("fs");
var path = require('path');

const NodeRSA = require('node-rsa');

module.exports = {
    getMessages: getMessages,
    addMessage: addMessage,
    addPhoto: addPhoto,
    getPhoto: getPhoto
};

var responses = [];
var timeouts = [];

var messages = [];

function sendResponse(res) {

    if(res === undefined)
        return;

    if (res.res !== undefined) {

        var client = mongoUtil.getDb();
        client.db('lchat').collection('messages').find().toArray(function (err, result) {
            if (err) {
                res.res.send(err);
            } else {
                var tempKey = new NodeRSA();
                tempKey.importKey(res.key, 'pkcs8-public-pem');
                
                res.res.json(tempKey.encrypt(result, 'base64'));
            }
        })
    }
}

var messageListener = function () {
    //console.log("Event called");
    //eventEmitter.removeListener('message', messageListener);
    responses.forEach(element => {
        sendResponse(element);
    });
    timeouts.forEach(element => {
        clearTimeout(element);
    });
    responses = [];
};

function getMessages(req, res) {
    // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
    //var name = req.swagger.params.name.value || 'stranger';
    //var hello = util.format('Hello, %s!', name);

    // this sends back a JSON response which is a single string

    var l = req.swagger.params.l.value;
    var token = req.swagger.params.token.value;

    var client = mongoUtil.getDb();

    client.db('lchat').collection('users').findOne({ token: token }, (err, doc) => {
        if (err)
            throw err;
        if (!doc) {
            res.status(404).json();
        } else {

            client.db('lchat').collection('messages').count({}, function (error, numOfDocs) {

                if (l != numOfDocs) {
                    sendResponse({res: res, key: doc.userKey});  
                    return;
                }
        
                var rid = responses.push({res: res, key: doc.userKey});
        
                timeouts.push(setTimeout(() => {
                    sendResponse(responses[rid - 1]);
                    responses.splice(rid - 1, 1);
                }, 60 * 1000));
            });
        }
    });
}

function addMessage(req, res) {
    var message = req.swagger.params.message.value;

    var client = mongoUtil.getDb();

    client.db('lchat').collection('users').findOne({ token: message.token }, (err, doc) => {
        if (err)
            throw err;
        if (!doc) {
            res.status(404).json();
        } else {

            const serverKey = new NodeRSA(doc.cryptoKey);
            message.text = serverKey.decrypt(message.text, 'utf8');

            message.text = message.text.replace(/(<((?!br)[^>]+)>)/ig, "");
            client.db('lchat').collection('messages').insertOne({
                user: doc._id,
                username: doc.name,
                message: message.text,
                time: new Date()
            }, function (err, res) {
                if (err) throw err;
               
            });
        }
    });


    /*messages.push(message);*/

    eventEmitter.emit('message');
    res.json("ok");
}

function addPhoto(req, res) {
    var token = req.swagger.params.token.value;
    var photo = req.files.photo;
    var base64 = new Buffer(photo.buffer).toString('base64');
    var client = mongoUtil.getDb();

    var d = new Date();

    var fname = d.getTime() + "." + photo.mimetype.split('/')[1];

    console.log(fname);

    fs.writeFile("uploads/"+fname, photo.buffer, (err) => {
        if (err) console.log(err);
        console.log("Successfully Written to File.");
      });
    client.db('lchat').collection('users').findOne({ token: token }, (err, doc) => {
        if (err)
            throw err;
        if (!doc) {
            res.status(404).json();
        } else {
            client.db('lchat').collection('messages').insertOne({
                user: doc._id,
                username: doc.name,
                message: '<img width="400px" src="http://127.0.0.1:10010/uploads?name='+fname+'"/>',
                time: new Date()
            }, function (err, res) {
                if (err) throw err;
               
            });
        }
    });
    eventEmitter.emit('message');
    res.json("ok");
}

function getPhoto(req, res) {
    var name = req.swagger.params.name.value;
    res.sendFile(path.resolve('uploads/' + name));
}

eventEmitter.on('message', messageListener);
