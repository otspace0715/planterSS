/*
 * GET users listing.
 */
var fs = require('fs')
  , Validator = require('validator').Validator;
  
var validator = new Validator();
var createErrors = null;

var iam = {
  read: function(){
    var words = "";
    if (fs.existsSync(__dirname + '/profile/iam.json')) {
      try {
        words = JSON.parse(fs.readFileSync(__dirname + '/profile/iam.json'));
      } catch (e) {
          return words;
      }
      return words;
    }
    return words;
  }
};

module.exports = {
  index: function(req, res) {
    if (req.session.user) {
        var words = iam.read();
        res.json(words);
    } else {
        module.exports.new(req, res);
    }
  },
  new: function(req, res) {
    var words = iam.read();
    if (words === "") {
      res.render('new', { title: 'New PlanterSS admin' });
    }
    res.json(words);
  },
  create: function(req, res) {
    createErrors = null;

    req.onValidationError = function(errback) {
        req.onErrorCallback = errback;
    };
    this.validationErrors = function() {
        if (createErrors === undefined | createErrors === null) {
          return null;
        }
        return createErrors;
    };

    this.check = function(param, value, fail_msg) {        
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
        }
        return validator.check(value, fail_msg);
    };

    var words = iam.read();
    if (words === "") {
        try {
            var json = JSON.parse(req.body.json);
        } catch (erros) {
            var msg = JSON.parse('{"json": "' + erros + '"}');
            res.json(msg);
            return;
        }
        if (json.email === undefined) {
           this.check("email", "", 'email is empty').notEmpty();
        }
        if (json.password === undefined) {
            this.check("password", "", 'password is empty').notEmpty();
        }
        if (json.password2 === undefined) {
            this.check("confirm password2", "", 'confirm password is empty').notEmpty();
        }
        this.check("email", json.email, 'valid email required').len(6, 64).isEmail();
        this.check("password", json.password, '8 to 20 characters required').len(8, 20);
        this.check("confirm password", json.password2, 'password is incorrect').equals(json.password);
        var errors = this.validationErrors();
        if (errors) {
            res.json(errors);
            return;
        }
        var fd = fs.openSync(__dirname + '/profile/iam.json', 'w');
        fs.writeSync(fd, '{\n    "email": "' + json.email + '"\n}');
        fs.closeSync(fd);
        fd = fs.openSync(__dirname + '/profile/iam-password.json', 'w');
        fs.writeSync(fd, '{\n    "password": "' + json.password + '"\n}');
        fs.closeSync(fd);
    }
    module.exports.index(req, res);
  },
  show: function(req, res) {
    res.send('show users');
  },
  edit: function(req,res) {
    res.send('edit users');
  },
  update: function(req, res) {
    res.send('update users');
  },
  destroy: function(req, res) {
    res.send('destroy users');
  }
};