
/**
 * Module dependencies.
 */

var express = require('express')
  , resource = require('express-resource')
  , routes = require('./routes')
  , setting = require('./routes/setting')
  , planterssEngine = require('./planterss-engine/lib/')
  , http = require('http')
  , path = require('path');

var MemoryStore = express.session.MemoryStore;

var app = module.exports = express.createServer();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.query());
  app.use(express.cookieParser());
  app.use(express.session({store: new MemoryStore({reapInterval: 5 * 60 * 1000}), secret: 'abracadabra'}));
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// json data path
planterssEngine.createProvider(__dirname + '/routes/data', {crypt_key: 'encryption secret', sign_key: 'signing secret', login_uri: '/login', secret_uri: '/secret', signup_uri: '/settings', clients: {'planterss': 'planterss secret'}}, app);

app.configure(function(){
  app.use(planterssEngine.oauth());
  app.use(planterssEngine.signup());
  app.use(planterssEngine.login());
});

app.get('/', routes.index);

app.resource('settings', setting, {id: 'id'});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
