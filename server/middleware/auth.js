const models = require('../models');
const Promise = require('bluebird');
const _ = require('lodash');

module.exports.createSession = (req, res, next) => {
  if (_.isEmpty(req.cookies)) {
    // no cookies, create session
    return _makeNewSessionAndCookies(req, res)
      .then(next);
  } else {
    // there are cookies, search sessions
    models.Sessions.get({ hash: req.cookies.shortlyid })
      .then(result => {
        if (result) {
          // there's a session associated with that cookie
          const { hash, userId } = result;
          req.session = { hash };
          if (userId) {
            // there's also a user associated with that session
            return models.Users.get({ id: userId });
          } else {
            // valid cookies, but there is no user
            return result;
          }
        } else {
          // Malicious cookie case
          return null;
        }
      }).then((result) => {
        if (result) {
          if (result.username) {
            // there's also a user associated with that session
            const { username, id } = result;
            _.extend(req.session, {
              user: { username: username },
              userId: id
            });
          } else {
            // valid cookies, but there is no user
            return null;
          }
        } else {
          // Malicious cookie case
          return _makeNewSessionAndCookies(req, res);
        }
      }).then(next);
  }
};

/************************************************************/
// Add additional authentication middleware functions below
/************************************************************/

let _makeNewSessionAndCookies = function (req, res) {
  return models.Sessions.create()
  .then(result => ({ 'id': result.insertId }))
  .then(options => models.Sessions.get(options))
  .then(({ hash }) => {
    req.session = { hash };
    res.cookie('shortlyid', hash);
  });
}
