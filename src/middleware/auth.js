/**
 * Middleware to ensure the user is authenticated.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  req.flash('error', 'You must be logged in to access this page.');
  res.redirect('/auth/login');
}

/**
 * Middleware factory that restricts access to users with one of the given roles.
 * @param {...string} roles - Allowed role strings.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      req.flash('error', 'You must be logged in to access this page.');
      return res.redirect('/auth/login');
    }
    if (!roles.includes(req.session.userRole)) {
      req.flash('error', 'You do not have permission to perform that action.');
      return res.redirect('/demands');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
