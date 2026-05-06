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

  function setOfficialFavicon() {
    document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]').forEach(function (link) {
      if (String(link.type || '').includes('svg')) {
        link.href = '/favicon.svg?v=folks-main';
        return;
      }
      link.href = '/favicon.png?v=folks-main';
    });
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(function (link) {
      link.href = '/apple-touch-icon.png?v=folks-main';
    });
  }

  function makeBrandGoHome() {
    document.querySelectorAll('.brand').forEach(function (brand) {
      if (brand.closest('a')) return;
      brand.setAttribute('role', 'link');
      brand.setAttribute('tabindex', '0');
      brand.setAttribute('aria-label', 'Về Admin Hub');
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', function () {
        window.location.assign('/admin/');
      });
      brand.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.assign('/admin/');
        }
      });
    });
  }

  function normalizeMenuLabels() {
    var labels = {
      'Admin Hub': 'Trang chính',
      'Control Center': 'Vận hành',
      'Console kỹ thuật': 'Kỹ thuật',
      'Visual Content Editor': 'Sửa trang',
      'Visual Editor': 'Sửa trang',
      'Blog Manager': 'Viết blog',
      'Lead Inbox': 'Lead',
      'Bulk Text Editor': 'Sửa chữ',
      'Blog EN': 'Blog EN',
      'Blog VI': 'Blog VI',
      'Home': 'Xem website',
      'Trang live': 'Xem website',
      'Xem website': 'Xem website',
      'Hướng dẫn': 'Hướng dẫn',
      'Đăng xuất': 'Đăng xuất',
      'Mở form': 'Mở form'
    };
    document.querySelectorAll('.nav a, .nav button, [data-admin-logout]').forEach(function (item) {
      var text = item.textContent.trim();
      if (labels[text]) item.textContent = labels[text];
    });
  }

  function normalizeVisibleCopy(root) {
    var replacements = [
      ['Admin Hub', 'Trang chính'],
      ['Control Center', 'Vận hành'],
      ['Console kỹ thuật', 'Kỹ thuật'],
      ['Visual Content Editor', 'Sửa trang'],
      ['Visual Editor', 'Sửa trang'],
      ['Blog Manager', 'Viết blog'],
      ['Lead Inbox', 'Lead'],
      ['Bulk Text Editor', 'Sửa chữ hàng loạt'],
      ['Export CSV', 'Xuất danh sách'],
      ['Upload ảnh', 'Tải ảnh lên'],
      ['Upload', 'Tải lên'],
      ['Preview', 'Xem trước'],
      ['Mã Markdown', 'Mã bài viết (kỹ thuật)'],
      ['Drafts', 'Nháp'],
      ['Draft đã lưu', 'Nháp đã lưu'],
      ['Editorial calendar', 'Lịch đăng bài'],
      ['Media library', 'Thư viện ảnh'],
      ['Newsletter', 'Email đăng ký'],
      ['Review queue', 'Hàng chờ duyệt'],
      ['Review item', 'Mục cần duyệt'],
      ['Draft -> Review -> Publish', 'Nháp -> Duyệt -> Đăng'],
      ['Audit log local + rollback target', 'Lịch sử thao tác và điểm khôi phục'],
      ['Audit log', 'Lịch sử thao tác'],
      ['Audit', 'Lịch sử'],
      ['Rollback file này', 'Khôi phục mục này'],
      ['Rollback', 'Khôi phục'],
      ['rollback', 'khôi phục'],
      ['SEO manager', 'Kiểm tra nội dung'],
      ['SEO', 'Hiển thị Google'],
      ['production', 'website live'],
      ['publish', 'đăng'],
      ['Publish', 'Đăng'],
      ['Deploy Center', 'Theo dõi đăng website'],
      ['deploy', 'đăng website'],
      ['Deploy', 'Đăng website'],
      ['Repository', 'Kho lưu dữ liệu'],
      ['Branch', 'Nhánh dữ liệu'],
      ['repo/branch', 'nơi lưu dữ liệu'],
      ['GitHub', 'nơi lưu website'],
      ['Vercel', 'dịch vụ đăng website'],
      ['CSRF + khóa repo/branch', 'Bảo vệ đăng nhập và nơi lưu dữ liệu'],
      ['CSRF', 'Bảo vệ form'],
      ['API', 'kết nối'],
      ['JSON', 'dữ liệu kỹ thuật'],
      ['Markdown', 'mã bài viết'],
      ['Search & replace có kiểm tra', 'Tìm và thay chữ có xem trước'],
      ['subscriber', 'người đăng ký'],
      ['Subscriber', 'Người đăng ký'],
      ['subscribers', 'người đăng ký'],
      ['Sức khỏe', 'Kiểm tra'],
      ['Kiểm tra cấu hình production', 'Kiểm tra trước khi đăng'],
      ['Chạy kiểm tra SEO', 'Chạy kiểm tra nội dung'],
      ['Xem audit', 'Xem lịch sử'],
      ['Mở Lead Inbox', 'Mở Lead']
    ];
    var skipTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'CODE', 'PRE'];
    var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if (!parent || skipTags.includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var value = node.nodeValue;
      replacements.forEach(function (pair) {
        value = value.split(pair[0]).join(pair[1]);
      });
      if (value !== node.nodeValue) node.nodeValue = value;
    });
  }

  function watchVisibleCopy() {
    var pending = false;
    var observer = new MutationObserver(function (mutations) {
      if (pending) return;
      if (!mutations.some(function (mutation) { return mutation.addedNodes && mutation.addedNodes.length; })) return;
      pending = true;
      window.setTimeout(function () {
        pending = false;
        normalizeVisibleCopy(document.body);
        normalizeMenuLabels();
        markTechnicalContent();
      }, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function markTechnicalContent() {
    document.querySelectorAll('details.advanced-box > summary').forEach(function (summary) {
      if (!summary.textContent.includes('nâng cao')) return;
      summary.textContent = 'Cài đặt dành cho kỹ thuật';
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
    setOfficialFavicon();
    makeBrandGoHome();
    normalizeMenuLabels();
    normalizeVisibleCopy(document.body);
    markTechnicalContent();
    watchVisibleCopy();
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
