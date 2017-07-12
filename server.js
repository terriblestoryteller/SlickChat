/**
 * Created by shubham on 10/7/17.
 */

var http = require('http');
var express = require('express');
var app = express();
var path = require('path');
var cors = require('cors');
var history = require('connect-history-api-fallback');
var socket = require('./routes/socket.js');

var server = http.createServer(app);

// Pass a http.Server instance to the listen method
var io = require('socket.io').listen(server);
// The server should start listening
server.listen(3321,function () {
    console.log("Server running at port 3321")
});
// Serving static file at /app
app.use('/app',express.static(path.join(__dirname,'/app')));

app.all('/*', function(req, res, next) {
    // Just send the index.html for other files to support HTML5Mode
    res.sendFile('/views/index.html', { root: __dirname });
});

app.use(cors());
app.use(history());

// Handle connection
io.on('connection',socket);
