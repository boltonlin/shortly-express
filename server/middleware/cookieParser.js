const parseCookies = (req, res, next) => {
  let cookie = req.headers.cookie;
  if (!cookie) {
    req.cookies = {};
  } else {
    let cookieObj = cookie.split('; ')
      .map(parts => parts.split('='))
      .reduce((container, parts) => {
        container[parts[0]] = parts[1];
        return container;
      }, {});
    req.cookies = cookieObj;
  }
  next();
};

module.exports = parseCookies;