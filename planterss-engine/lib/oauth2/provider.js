/**
 * Module dependencies.
 */
var express = require('express')
  , OAuth2Provider = require('oauth2-provider').OAuth2Provider
  , EventEmitter = require('events').EventEmitter
  , app = express.application
  , fs = require('fs');

var myOAP = function(){};
// hardcoded list of <client id, client secret> tuples
var myClients = {};
// temporary grant storage
var myGrants = {};

var myOptions = {};

var myApp = function(){};

function Provider(){
}

Provider.prototype = new EventEmitter();

Provider.prototype.createProvider = function(dataPath, defaultKey, app){
    myOptions = defaultKey;
    myApp = app;
    myClients = myOptions.clients;
    myGrants = {};

    if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, '0755');
    }
    if (!fs.existsSync(dataPath + '/key.json')) {
        fs.writeFileSync(dataPath + '/key.json', JSON.stringify(defaultKey) + '\n');
    }

    myOptions = JSON.parse(fs.readFileSync(dataPath + '/key.json'));
    myClients = myOptions.clients;
    myOAP = new OAuth2Provider(myOptions);

    // before showing setup page, make sure the user is made in
    myOAP.on('enforce_setup', function(req, res, authorize_url, next) {
      if (fs.existsSync(dataPath + '/iam.json')) {
        next(req.session.user);
      } else {
        res.writeHead(303, {Location: myOptions.signup_uri + '?next=' + encodeURIComponent(authorize_url)});
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
      res.end('<html>this app wants to access your account... <form method="post" action="' + authorize_url + '"><button name="allow">Allow</button><button name="deny">Deny</button></form>');
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

Provider.prototype.oauth = function() {
    var oauth = myOAP.oauth();
    myApp.get('/secret', function(req, res, next) {
        if(req.session.user) {
            res.end('proceed to secret lair, extra data: ' + JSON.stringify(req.session.data));
        } else {
            res.writeHead(403);
            res.end('no');
        }
    });

    return oauth;
};

Provider.prototype.signup = function() {
  var self = myOAP;

  return function(req, res, next) {
    var data, atok, user_id, client_id, grant_date, extra_data;

    if(req.query['access_token']) {
      atok = req.query['access_token'];
    } else if((req.headers['authorization'] || '').indexOf('Bearer ') === 0) {
      atok = req.headers['authorization'].replace('Bearer', '').trim();
    } else {
      return next();
    }

    try {
      data = self.serializer.parse(atok);
      user_id = data[0];
      client_id = data[1];
      grant_date = new Date(data[2]);
      extra_data = data[3];
    } catch(e) {
      res.writeHead(400);
      return res.end(e.message);
    }

    self.emit('access_token', req, {
      user_id: user_id,
      client_id: client_id,
      extra_data: extra_data,
      grant_date: grant_date
    }, next);
  };
};

Provider.prototype.login = function() {
    var login = myOAP.login();
    myApp.get('/login', function(req, res, next) {
        if(req.session.user) {
            res.writeHead(303, {Location: '/'});
            return res.end();
        }

        var next_url = req.query.next ? req.query.next : '/';
    
        // jade format 
        res.render('login', {  title: 'PlanterSS Login', next_url: next_url });
        // res.end('<html><form method="post" action="/login"><input type="hidden" name="next" value="' + next_url + '"><input type="text" placeholder="username" name="username"><input type="password" placeholder="password" name="password"><button type="submit">Login</button></form>');
    });

    myApp.post('/login', function(req, res, next) {
        req.session.user = req.body.username;

        res.writeHead(303, {Location: req.body.next || '/'});
        res.end();
    });

    myApp.get('/logout', function(req, res, next) {
        req.session.destroy(function(err) {
            res.writeHead(303, {Location: '/'});
            res.end();
        });
    });

    return login;
};

/**
 * Expose `Provider`.
 */ 
module.exports = Provider;
