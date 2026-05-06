(function () {
  function readCookie(name) {
    return document.cookie
      .split(';')
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean)
      .reduce(function (value, part) {
        var separator = part.indexOf('=');
        var key = separator >= 0 ? part.slice(0, separator) : part;
        if (key !== name) return value;
        return decodeURIComponent(separator >= 0 ? part.slice(separator + 1) : '');
      }, '');
  }

  var nativeFetch = window.fetch.bind(window);
  var redirectingToLogin = false;

  function loginUrl() {
    var next = window.location.pathname + window.location.search + window.location.hash;
    return '/admin/login.html?next=' + encodeURIComponent(next);
  }

  function showSessionExpired() {
    if (redirectingToLogin || window.location.pathname.endsWith('/admin/login.html')) return;
    redirectingToLogin = true;
    var banner = document.createElement('div');
    banner.setAttribute('role', 'alert');
    banner.style.cssText = [
      'position:fixed',
      'left:16px',
      'right:16px',
      'top:16px',
      'z-index:99999',
      'border:1px solid #fecaca',
      'border-radius:8px',
      'background:#fef2f2',
      'color:#991b1b',
      'box-shadow:0 18px 55px rgb(38 38 38 / 18%)',
      'padding:12px 14px',
      'font:850 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    ].join(';');
    banner.textContent = 'Phiên đăng nhập admin đã hết hạn. CMS đang chuyển bạn về trang đăng nhập...';
    document.body.appendChild(banner);
    window.setTimeout(function () {
      window.location.assign(loginUrl());
    }, 900);
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    var options = init ? Object.assign({}, init) : {};
    var method = String(options.method || (input && input.method) || 'GET').toUpperCase();
    var isAdminApi = String(url || '').startsWith('/api/admin-') && !String(url || '').startsWith('/api/admin-auth');

    if (isAdminApi && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      var headers = new Headers(options.headers || (input && input.headers) || {});
      var csrf = readCookie('folks_admin_csrf');
      if (csrf && !headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', csrf);
      }
      options.headers = headers;
      options.credentials = options.credentials || 'same-origin';
    }

    return nativeFetch(input, options).then(function (response) {
      if (isAdminApi && response.status === 401) showSessionExpired();
      return response;
    });
  };

  function signOut() {
    fetch('/api/admin-logout', {
      method: 'POST',
    }).finally(function () {
      window.location.assign('/admin/login.html');
    });
  }

  window.FolksAdminSession = {
    showSessionExpired: showSessionExpired,
    loginUrl: loginUrl
  };

  function checkSessionEarly() {
    if (window.location.pathname.endsWith('/admin/login.html')) return;
    nativeFetch('/api/admin-auth?check=session', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json'
      }
    })
      .then(function (response) {
        if (response.status === 401) showSessionExpired();
      })
      .catch(function () {
        // Network or configuration errors should not trap the editor on login.
      });
  }

  function addLogoutButtons() {
    document.querySelectorAll('[data-admin-logout]').forEach(function (button) {
      button.addEventListener('click', signOut);
    });
    checkSessionEarly();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLogoutButtons);
  } else {
    addLogoutButtons();
  }
})();
