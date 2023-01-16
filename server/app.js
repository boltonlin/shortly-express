const express = require('express');
const path = require('path');
const utils = require('./lib/hashUtils');
const partials = require('express-partials');
const Auth = require('./middleware/auth');
const models = require('./models');
const cookieParser = require('./middleware/cookieParser');
const app = express();

app.set('views', `${__dirname}/views`);
app.set('view engine', 'ejs');
app.use(partials());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(cookieParser);
app.use(Auth.createSession);

app.get('/',
(req, res) => {
  verifySession(req, res, () => res.render('index'));
});

app.get('/create',
(req, res) => {
  verifySession(req, res, () => res.render('index'));
});

app.get('/links',
(req, res, next) => {
  verifySession(req, res, () => {
    models.Links.getAll()
      .then(links => {
        res.status(200).send(links);
      })
      .error(error => {
        res.status(500).send(error);
      })
  });
});

var verifySession = function (req, res, successCb) {
  if (!models.Sessions.isLoggedIn(req.session)) {
    res.redirect('/login');
  } else {
    successCb();
  }
}

app.post('/links',
(req, res, next) => {
  var url = req.body.url;
  if (!models.Links.isValidUrl(url)) {
    // send back a 404 if link is not valid
    return res.sendStatus(404);
  }

  return models.Links.get({ url })
    .then(link => {
      if (link) {
        throw link;
      }
      return models.Links.getUrlTitle(url);
    })
    .then(title => {
      return models.Links.create({
        url: url,
        title: title,
        baseUrl: req.headers.origin
      });
    })
    .then(results => {
      return models.Links.get({ id: results.insertId });
    })
    .then(link => {
      throw link;
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(link => {
      res.status(200).send(link);
    });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/signup',
(req, res) => {
  const { username, password } = req.body;
  models.Users.create({ username, password })
    .then(result => {
      return models.Sessions.update(
        { hash: req.session.hash },
        { userId: result.insertId }
      );
    }).then(result => res.redirect(201, '/'))
    .catch(err => res.redirect(400, '/signup'));
});

app.get('/login',
(req, res) => {
  res.render('login');
});

app.post('/login',
(req, res) => {
  const { username, password: attempt } = req.body;
  models.Users.get({username: username})
    .then((result) => {
      if (result) {
        const { password, salt } = result;
        if (models.Users.compare(attempt, password, salt)) {
          // SUCCESSFUL LOGIN
          res.redirect(200, '/');
        } else {
          // UNSUCCESSFUL LOGIN
          res.redirect(401, '/login');
        }
      } else {
        // USER DOESN'T EXIST
        res.redirect(400, '/login');
      }
    }).catch(err => res.redirect(400, '/login'));
});

app.get('/logout',
(req, res) => {
  models.Sessions.delete({ hash: req.session.hash })
  .then(() => {
      res.cookie('shortlyid', null);
      res.redirect('/login');
      res.end();
    });
});

/************************************************************/
// Handle the code parameter route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/:code', (req, res, next) => {

  return models.Links.get({ code: req.params.code })
    .tap(link => {

      if (!link) {
        throw new Error('Link does not exist');
      }
      return models.Clicks.create({ linkId: link.id });
    })
    .tap(link => {
      return models.Links.update(link, { visits: link.visits + 1 });
    })
    .then(({ url }) => {
      res.redirect(url);
    })
    .error(error => {
      res.status(500).send(error);
    })
    .catch(() => {
      res.redirect('/');
    });
});

module.exports = app;
