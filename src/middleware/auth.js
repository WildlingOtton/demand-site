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

function getEffectiveRole(req) {
  if (!req.session || !req.session.userId) return null;

  const actualRole = req.session.userRole;
  const previewRole = req.session.previewRole;
  const allowedPreviewRoles = ['admin', 'hiring_manager', 'basic_user'];

  if (actualRole === 'admin' && allowedPreviewRoles.includes(previewRole)) {
    return previewRole;
  }

  return actualRole;
}

function getSessionUser(req) {
  if (!req.session || !req.session.userId) return null;

  const actualRole = req.session.userRole;
  const effectiveRole = getEffectiveRole(req);
  const isPreviewing =
    actualRole === 'admin' &&
    typeof req.session.previewRole === 'string' &&
    req.session.previewRole !== actualRole;

  return {
    id: req.session.userId,
    username: req.session.username,
    role: effectiveRole,
    actualRole,
    previewRole: actualRole === 'admin' ? effectiveRole : null,
    isRolePreviewing: isPreviewing,
  };
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
    const currentRole = getEffectiveRole(req);
    if (!roles.includes(currentRole)) {
      req.flash('error', 'You do not have permission to perform that action.');
      return res.redirect('/demands');
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, getEffectiveRole, getSessionUser };
