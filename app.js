
/**
 * Module dependencies.
 */

var express = require('express')
  , pg = require('pg')
  , routes = require('./routes')
  , optimize = require('./routes/optimize')
  , simulate = require('./routes/simulate')
  , http = require('http')
  , path = require('path');
var ga = require('node-ga');
var ua = "UA-40699753-2";
var host = "blsapp.net";

var app = express();

// all environments
app.set('port', process.env.PORT || 4242);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(ga(ua, {
	safe: true
}));
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));
app

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}
app.post('/simulate', simulate);

app.post('/optimize', optimize);

app.get('/', routes.index);

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
