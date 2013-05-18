
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

// json data path
planterssEngine.createProvider(__dirname + '/routes/data', {crypt_key: 'encryption secret', sign_key: 'signing secret', clients: {'planterss': 'planterss secret'}});

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
  app.use(planterssEngine.oauth());
  app.use(planterssEngine.signup());
  app.use(planterssEngine.login());
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/login', function(req, res, next) {
  if(req.session.user) {
    res.writeHead(303, {Location: '/'});
    return res.end();
  }

  var next_url = req.query.next ? req.query.next : '/';

  res.end('<html><form method="post" action="/login"><input type="hidden" name="next" value="' + next_url + '"><input type="text" placeholder="username" name="username"><input type="password" placeholder="password" name="password"><button type="submit">Login</button></form>');
});

app.post('/login', function(req, res, next) {
  req.session.user = req.body.username;

  res.writeHead(303, {Location: req.body.next || '/'});
  res.end();
});

app.get('/logout', function(req, res, next) {
  req.session.destroy(function(err) {
    res.writeHead(303, {Location: '/'});
    res.end();
  });
});

app.get('/secret', function(req, res, next) {
  if(req.session.user) {
    res.end('proceed to secret lair, extra data: ' + JSON.stringify(req.session.data));
  } else {
    res.writeHead(403);
    res.end('no');
  }
});

app.resource('settings', setting, {id: 'id'});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
