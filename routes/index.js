
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'PlanterSS', src: '/oauth/authorize?client_id=planterss&redirect_uri=http://planterss.otspace.c9.io/settings/&response_type=token' });
  
};