/**
 * Module dependencies.
 */
var OAuth2Provider = require('oauth2-provider').OAuth2Provider
  , EventEmitter = require('events').EventEmitter
  , Validator = require('validator').Validator
  , i18n = require("i18n")
  , fs = require('fs');

var Provider = function(){};
var myOAP = function(){};
var myApp = function(){};

// hardcoded list of <client id, client secret> tuples
var myClients = {};
// temporary grant storage
var myGrants = {};

var myOptions = {};

var myKey = {};

var myLang = {};

var validator = new Validator();
var createErrors = null;

myOptions.signup_uri = '/signup';
myOptions.secret_uri = '/secret';
myOptions.login_uri = '/login';
myKey.crypt_key = 'encryption secret';
myKey.sign_key = 'signing secret';
Provider.prototype = new EventEmitter();

Provider.prototype.createProvider = function(app){
    myApp = app;
    myGrants = {};
    i18n.configure({
        // setup some locales - other locales default to en silently
        locales:['en', 'ja'],
    
        // you may alter a site wide default locale
        defaultLocale: 'ja',
    
        // sets a custom cookie name to parse locale settings from  - defaults to NULL
        cookie: 'i18n-lang',
    
        // where to store json files - defaults to './locales'
        directory: myApp.get('locales'),
    
        // whether to write new locale information to disk - defaults to true
        // updateFiles: false,
    
        // setting extension of json files - defaults to '.json' (you might want to set this to '.js' according to webtranslateit)
        // extension: '.js',
    });

    myOAP = new OAuth2Provider(myKey);
    myLang.authorize = i18n.__('authorize');
    myLang.signup = i18n.__('signup');
    myLang.login = i18n.__('login');

    // before showing setup page, make sure the user is made in
    myOAP.on('enforce_setup', function(req, res, next) {
      if (fs.existsSync(myApp.get('datapath') + '/iam.json')) {
        next(req.session.client_id);
      } else {
        res.writeHead(303, {Location: myOptions.signup_uri });
        res.end();
      }
    });

    // before showing authorization page, make sure the user is logged in
    myOAP.on('enforce_login', function(req, res, authorize_url, next) {
      if(req.session.user) {
        next(req.session.user);
      } else {
        res.writeHead(303, {Location: myOptions.login_uri + '?next=' + encodeURIComponent(authorize_url)});
        res.end();
      }
    });
    
    // render the authorize form with the submission URL
    // use two submit buttons named "allow" and "deny" for the user's choice
    myOAP.on('authorize_form', function(req, res, client_id, authorize_url) {
        res.render('authorize',  {  title: myLang.authorize.title, authorize_url: authorize_url });
    });
    
    // save the generated grant code for the current user
    myOAP.on('save_grant', function(req, client_id, code, next) {
      if(!(req.session.user in myGrants))
        myGrants[req.session.user] = {};
    
      myGrants[req.session.user][client_id] = code;
      next();
    });
    
    // remove the grant when the access token has been sent
    myOAP.on('remove_grant', function(user_id, client_id, code) {
      if(myGrants[user_id] && myGrants[user_id][client_id])
        delete myGrants[user_id][client_id];
    });
    
    // find the user for a particular grant
    myOAP.on('lookup_grant', function(client_id, client_secret, code, next) {
      // verify that client id/secret pair are valid
      if(client_id in myClients && myClients[client_id] == client_secret) {
        for(var user in myGrants) {
          var clients = myGrants[user];
    
          if(clients[client_id] && clients[client_id] == code)
            return next(null, user);
        }
      }
    
      next(new Error('no such grant found'));
    });
    
    // embed an opaque value in the generated access token
    myOAP.on('create_access_token', function(user_id, client_id, next) {
      var data = 'blah'; // can be any data type or null
    
      next(data);
    });
    
    // (optional) do something with the generated access token
    myOAP.on('save_access_token', function(user_id, client_id, access_token) {
      console.log('saving access token %s for user_id=%s client_id=%s', access_token, user_id, client_id);
    });
    
    // an access token was received in a URL query string parameter or HTTP header
    myOAP.on('access_token', function(req, token, next) {
      var TOKEN_TTL = 10 * 60 * 1000; // 10 minutes
    
      if(token.grant_date.getTime() + TOKEN_TTL > Date.now()) {
        req.session.user = token.user_id;
        req.session.data = token.extra_data;
      } else {
        console.warn('access token for user %s has expired', token.user_id);
      }
    
      next();
    });
    
    // (optional) client authentication (xAuth) for trusted clients
    myOAP.on('client_auth', function(client_id, client_secret, username, password, next) {
      if(client_id == 'planterss' && username == 'guest') {
//        var user_id = '1337';
        var user_id = 'guest';
    
        return next(null, user_id);
      }
    
      return next(new Error('client authentication denied'));
    });
};

Provider.prototype.signup = function() {
    var self = this;
    if (!fs.existsSync(myApp.get('datapath'))) {
        fs.mkdirSync(myApp.get('datapath'), '0755');
    }
    var signup = function(req, res, next) {
        var uri = ~req.url.indexOf('?') ? req.url.substr(0, req.url.indexOf('?')) : req.url;
        if(req.method == 'GET' && (myOptions.signup_uri == uri)) {
            // authorization form will be POSTed to same URL, so we'll have all params
            var signup_url = req.url;
            self.emit('enforce_signup', req, res, function(client_id) {

                var authorize_url = '/oauth/authorize?client_id=planterss&redirect_uri=http://planterss.otspace.c9.io/settings/&response_type=token'
                self.emit('enforce_login', req, res,  client_id, authorize_url);
            });
    
        } else if(req.method == 'POST' && myOptions.signup_uri == uri) {
        } else {
            return next();
        }
    };
    var iam = function(){
        var words = "";
        if (fs.existsSync(myApp.get('datapath') + '/iam.json')) {
          try {
            words = JSON.parse(fs.readFileSync(myApp.get('datapath') + '/iam.json'));
          } catch (e) {
              return words;
          }
          return words;
        }
        return words;
    };

    myApp.get(myOptions.signup_uri, function(req, res, next) {
        var next_url = req.query.next ? req.query.next : '/';
        if (!req.session.clients) {
            if (!fs.existsSync(myApp.get('datapath') + '/clients.json')) {
                var defaultKey = JSON.parse('{"client_id": {"id": "planterss"}, "clients":{"planterss":"planterss secret"}}');
                if (defaultKey !== undefined) {
                    fs.writeFileSync(myApp.get('datapath') + '/clients.json', JSON.stringify(defaultKey) + '\n');
                }
                res.render('signup', {
                    title: myLang.signup.title,
                    next_url: next_url,
                    email: myLang.signup.email,
                    username: myLang.signup.username,
                    password: myLang.signup.password,
                    password2: myLang.signup.password2,
                    client_id: myLang.signup.client_id,
                    button: myLang.signup.button,
                    errors: '' });
                    return;
            }

            myClients = JSON.parse(fs.readFileSync(myApp.get('datapath') + '/clients.json'));
            req.session.clients = myClients.clients;

            var words = iam(req, res);
            if (words === "") {
                res.render('signup', {
                    title: myLang.signup.title,
                    next_url: next_url,
                    email: myLang.signup.email,
                    username: myLang.signup.username,
                    password: myLang.signup.password,
                    password2: myLang.signup.password2,
                    client_id: myLang.signup.client_id,
                    button: myLang.signup.button,
                    errors: '' });
            }
        }
        return;
    });
    myApp.post(myOptions.signup_uri, function(req, res, next) {
        var next_url = req.query.next ? req.query.next : '/';
        createErrors = null;
    
        req.onValidationError = function(errback) {
            req.onErrorCallback = errback;
        };
        var validationErrors = function() {
            if (createErrors === undefined | createErrors === null) {
              return null;
            }
            return createErrors;
        };
    
        var check = function(param, value, fail_msg) {        
            validator.error = function(msg) {
              var error = {
                param: param,
                msg: msg,
                value: value
              };
              if (createErrors === undefined | createErrors === null) {
                createErrors = [];
              }
              createErrors.push(error);
              if (req.onErrorCallback) {
                req.onErrorCallback(msg);
              }
              return this;
            };
            return validator.check(value, fail_msg);
        };
    
        var words = iam(req, res);
        if (words === "") {
            var data = null;
            try {
                data = JSON.parse(req.query);
            } catch (erros) {
                var msg = JSON.parse('{"json": "' + erros + '"}');
                res.render('signup', {
                    title: myLang.signup.title,
                    next_url: next_url,
                    email: myLang.signup.email,
                    username: myLang.signup.username,
                    password: myLang.signup.password,
                    password2: myLang.signup.password2,
                    client_id: myLang.signup.client_id,
                    button: myLang.signup.button,
                    errors: JSON.stringify(msg) });
            }
            if (data !== null) {
                if (data.email === undefined) {
                   check("email", "", 'email is empty').notEmpty();
                }
                if (data.password === undefined) {
                    check("password", "", 'password is empty').notEmpty();
                }
                if (data.password2 === undefined) {
                    check("confirm password2", "", 'confirm password is empty').notEmpty();
                }
                check("email", data.email, 'valid email required').len(6, 64).isEmail();
                check("password", data.password, '8 to 20 characters required').len(8, 20);
                check("confirm password", data.password2, 'password is incorrect').equals(data.password);
                var errors = validationErrors();
                if (errors) {
                    res.render('signup', {
                        title: myLang.signup.title,
                        next_url: next_url,
                        email: myLang.signup.email,
                        username: myLang.signup.username,
                        password: myLang.signup.password,
                        password2: myLang.signup.password2,
                        client_id: myLang.signup.client_id,
                        button: myLang.signup.button,
                        errors: JSON.stringify(errors) });
                }
                var fd = fs.openSync(self.myDataPath + '/iam.json', 'w');
                fs.writeSync(fd, '{\n    "email": "' + data.email + '"\n}');
                fs.closeSync(fd);
                fd = fs.openSync(self.myDataPath + '/iam-password.json', 'w');
                fs.writeSync(fd, '{\n    "password": "' + data.password + '"\n}');
                fs.closeSync(fd);
                fd = fs.openSync(self.myDataPath + '/clients.json', 'w');
                fs.writeSync(fd, '{\n    "clients": "' + data.clients + '"\n}');
                fs.closeSync(fd);
            }
        }
        return;
    });
    
    return signup;
};

Provider.prototype.oauth = function() {
    var oauth = myOAP.oauth();
    myApp.get(myOptions.secret_uri, function(req, res, next) {
        if(req.session.user) {
            res.end('proceed to secret lair, extra data: ' + JSON.stringify(req.session.data));
        } else {
            res.writeHead(403);
            res.end('no');
        }
    });

    return oauth;
};

Provider.prototype.login = function() {
    var login = myOAP.login();
    myApp.get(myOptions.login_uri, function(req, res, next) {
        if(req.session.user) {
            res.writeHead(303, {Location: '/'});
            return res.end();
        }

        var next_url = req.query.next ? req.query.next : '/';
    
        // jade format 
        res.render('login', {
            title: myLang.login.title,
            next_url: next_url,
            button: myLang.login.button,
            username: myLang.login.username,
            password: myLang.login.password});
        // res.end('<html><form method="post" action="/login"><input type="hidden" name="next" value="' + next_url + '"><input type="text" placeholder="username" name="username"><input type="password" placeholder="password" name="password"><button type="submit">Login</button></form>');
    });

    myApp.post(myOptions.login_uri, function(req, res, next) {
        req.session.user = req.body.username;

        res.writeHead(303, {Location: req.body.next || '/'});
        return res.end();
    });

    myApp.get('/logout', function(req, res, next) {
        req.session.destroy(function(err) {
            res.writeHead(303, {Location: '/'});
            return res.end();
        });
    });

    return login;
};
/**
 * Expose `Provider`.
 */ 
module.exports = Provider;
