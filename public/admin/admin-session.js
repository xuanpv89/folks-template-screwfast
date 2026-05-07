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
        return decodeURIComponent(
          separator >= 0 ? part.slice(separator + 1) : ''
        );
      }, '');
  }

  var nativeFetch = window.fetch.bind(window);
  var redirectingToLogin = false;

  function loginUrl() {
    var next =
      window.location.pathname + window.location.search + window.location.hash;
    return '/admin/login.html?next=' + encodeURIComponent(next);
  }

  function showSessionExpired() {
    if (
      redirectingToLogin ||
      window.location.pathname.endsWith('/admin/login.html')
    )
      return;
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
      'font:850 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    ].join(';');
    banner.textContent =
      'Phiên đăng nhập admin đã hết hạn. CMS đang chuyển bạn về trang đăng nhập...';
    document.body.appendChild(banner);
    window.setTimeout(function () {
      window.location.assign(loginUrl());
    }, 900);
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url;
    var options = init ? Object.assign({}, init) : {};
    var method = String(
      options.method || (input && input.method) || 'GET'
    ).toUpperCase();
    var isAdminApi =
      String(url || '').startsWith('/api/admin-') &&
      !String(url || '').startsWith('/api/admin-auth');

    if (isAdminApi && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      var headers = new Headers(
        options.headers || (input && input.headers) || {}
      );
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
    document
      .querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]')
      .forEach(function (link) {
        if (String(link.type || '').includes('svg')) {
          link.href = '/favicon.svg?v=folks-main';
          return;
        }
        link.href = '/favicon.png?v=folks-main';
      });
    document
      .querySelectorAll('link[rel="apple-touch-icon"]')
      .forEach(function (link) {
        link.href = '/apple-touch-icon.png?v=folks-main';
      });
  }

  function makeBrandGoHome() {
    if (!document.getElementById('top') && !document.body.id) {
      document.body.id = 'top';
    }
    document.querySelectorAll('.brand').forEach(function (brand) {
      if (brand.tagName === 'A') {
        brand.href = '#top';
        brand.setAttribute('aria-label', 'Về đầu trang');
        return;
      }
      brand.setAttribute('role', 'link');
      brand.setAttribute('tabindex', '0');
      brand.setAttribute('aria-label', 'Về đầu trang');
      brand.style.cursor = 'pointer';
      brand.addEventListener('click', function () {
        window.location.hash = 'top';
      });
      brand.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.hash = 'top';
        }
      });
    });
  }

  function tagAdminPage() {
    var path = window.location.pathname;
    document.body.classList.toggle(
      'admin-home',
      path === '/admin/' || path === '/admin/index.html'
    );
    document.body.classList.toggle(
      'admin-console',
      path.endsWith('/admin/console.html')
    );
  }

  function simplifyAdminNav() {
    document.querySelectorAll('.nav').forEach(function (nav) {
      if (nav.dataset.standardized === 'true') return;
      var path = window.location.pathname.replace(/\/$/, '/');
      var isCurrent = function (href) {
        if (href === '/admin/')
          return path === '/admin/' || path === '/admin/index.html';
        return path.endsWith(href);
      };
      var items = [
        { label: 'Trang Chủ Admin', href: '/admin/' },
        { label: 'Sửa trang', href: '/admin/content.html' },
        { label: 'Viết blog', href: '/admin/blog.html' },
        { label: 'Lead', href: '/admin/leads.html' },
        { label: 'Vận hành', href: '/admin/operations.html' },
        { label: 'Hướng dẫn', href: '/admin/guide.html' },
      ];
      if (path.endsWith('/admin/text.html')) {
        items.splice(3, 0, {
          label: 'Sửa chữ hàng loạt',
          href: '/admin/text.html',
        });
      }
      if (path.endsWith('/admin/console.html')) {
        items = [
          { label: 'Trang Chủ Admin', href: '/admin/' },
          { label: 'Vận hành', href: '/admin/operations.html' },
          { label: 'Kỹ thuật', href: '/admin/console.html' },
        ];
      }
      if (path.endsWith('/admin/leads.html')) {
        items.push({ label: 'Mở form', href: '/contact', target: '_blank' });
      }

      nav.innerHTML = '';
      items.forEach(function (item) {
        var link = document.createElement('a');
        link.href = item.href;
        link.textContent = item.label;
        if (item.target) {
          link.target = item.target;
          link.rel = 'noreferrer';
        }
        if (isCurrent(item.href)) {
          link.setAttribute('aria-current', 'page');
        } else {
          link.className = 'secondary';
        }
        nav.appendChild(link);
      });
      var logout = document.createElement('button');
      logout.type = 'button';
      logout.className = 'secondary';
      logout.setAttribute('data-admin-logout', '');
      logout.textContent = 'Đăng xuất';
      nav.appendChild(logout);
      nav.dataset.standardized = 'true';
    });
  }

  function normalizeMenuLabels() {
    var labels = {
      'Admin Hub': 'Trang Chủ Admin',
      'Trang chính': 'Trang Chủ Admin',
      'Control Center': 'Vận hành',
      'Console kỹ thuật': 'Kỹ thuật',
      'Visual Content Editor': 'Sửa trang',
      'Visual Editor': 'Sửa trang',
      'Blog Manager': 'Viết blog',
      'Lead Inbox': 'Lead',
      'Bulk Text Editor': 'Sửa chữ',
      'Blog EN': 'Blog EN',
      'Blog VI': 'Blog VI',
      Home: 'Trang Chủ Admin',
      'Trang live': 'Trang Chủ Admin',
      'Xem website': 'Trang Chủ Admin',
      'Hướng dẫn': 'Hướng dẫn',
      'Đăng xuất': 'Đăng xuất',
      'Mở form': 'Mở form',
    };
    document
      .querySelectorAll('.nav a, .nav button, [data-admin-logout]')
      .forEach(function (item) {
        var text = item.textContent.trim();
        if (labels[text]) item.textContent = labels[text];
      });
  }

  function normalizeVisibleCopy(root) {
    var replacements = [
      ['Admin Hub', 'Trang Chủ Admin'],
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
      [
        'Audit log local + rollback target',
        'Lịch sử thao tác và điểm khôi phục',
      ],
      ['Audit log', 'Lịch sử thao tác'],
      ['Audit events', 'Lịch sử thay đổi'],
      ['Audit', 'Lịch sử'],
      ['Rollback file này', 'Khôi phục mục này'],
      ['Rollback', 'Khôi phục'],
      ['rollback', 'khôi phục'],
      ['SEO manager', 'Kiểm tra nội dung'],
      ['production', 'website live'],
      ['publish', 'đăng'],
      ['Publish', 'Đăng'],
      ['Deploy Center', 'Theo dõi đăng website'],
      ['deploy', 'đăng website'],
      ['Deploy', 'Đăng website'],
      ['Repository', 'Kho lưu dữ liệu'],
      ['Repo', 'Nơi lưu dữ liệu'],
      ['Branch', 'Nhánh dữ liệu'],
      ['repo/branch', 'nơi lưu dữ liệu'],
      ['GitHub', 'nơi lưu website'],
      ['Vercel', 'dịch vụ đăng website'],
      ['CSRF + khóa repo/branch', 'Bảo vệ đăng nhập và nơi lưu dữ liệu'],
      ['CSRF', 'Bảo vệ form'],
      ['API', 'kết nối'],
      ['Health check', 'Kiểm tra sẵn sàng'],
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
      ['Mở Lead Inbox', 'Mở Lead'],
    ];
    var skipTags = [
      'SCRIPT',
      'STYLE',
      'TEXTAREA',
      'INPUT',
      'OPTION',
      'CODE',
      'PRE',
    ];
    var walker = document.createTreeWalker(
      root || document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node.nodeValue || !node.nodeValue.trim())
            return NodeFilter.FILTER_REJECT;
          var parent = node.parentElement;
          if (!parent || skipTags.includes(parent.tagName))
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );
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
      if (
        !mutations.some(function (mutation) {
          return mutation.addedNodes && mutation.addedNodes.length;
        })
      )
        return;
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
    document
      .querySelectorAll('details.advanced-box > summary')
      .forEach(function (summary) {
        if (!summary.textContent.includes('nâng cao')) return;
        summary.textContent = 'Cài đặt dành cho kỹ thuật';
      });
  }

  function simplifyAdminHome() {
    if (!document.body.classList.contains('admin-home')) return;

    var heroTitle = document.querySelector('.hero h2');
    if (heroTitle)
      heroTitle.textContent = 'Ưu tiên rõ, luồng việc gọn, thao tác đúng chỗ.';

    var heroCopy = document.querySelector('.hero p:not(.eyebrow)');
    if (heroCopy) {
      heroCopy.textContent =
        'Trang chính được sắp lại theo cách admin làm việc mỗi ngày: xem việc cần xử lý, chọn đúng luồng, rồi mở công cụ phù hợp. Các phần kỹ thuật, cấu hình và phục hồi vẫn có chỗ riêng để màn hình đầu tiên không bị rối.';
    }

    var searchTitle = document.querySelector('.global-search h2');
    if (searchTitle) searchTitle.textContent = 'Tìm nhanh công cụ';

    var moduleGrid = document.querySelector('.grid[aria-label="CMS modules"]');
    if (moduleGrid) {
      moduleGrid.setAttribute('aria-hidden', 'true');
    }

    document
      .querySelectorAll('.task-board .task-link')
      .forEach(function (link) {
        var href = link.getAttribute('href') || '';
        if (href.includes('/admin/console.html')) {
          link.setAttribute('href', '/admin/operations.html#media');
        }
      });
  }

  function simplifyConsolePage() {
    if (!document.body.classList.contains('admin-console')) return;

    var heroEyebrow = document.querySelector('.hero .eyebrow');
    var heroTitle = document.querySelector('.hero h2');
    var heroCopy = document.querySelector('.hero p:not(.eyebrow)');
    if (heroEyebrow) heroEyebrow.textContent = 'Khu kỹ thuật';
    if (heroTitle)
      heroTitle.textContent = 'Công cụ kiểm tra, ảnh và an toàn trước khi đăng';
    if (heroCopy) {
      heroCopy.textContent =
        'Console chỉ giữ các thao tác kỹ thuật thật sự cần đứng riêng: tải ảnh, checklist trước khi public, nhật ký cục bộ và các cài đặt đã khóa. Việc sửa trang, viết blog và xử lý lead mở trực tiếp từ Admin Hub.';
    }

    document
      .querySelectorAll(
        '[data-open-task="pages"], [data-open-task="leads"], [data-open-task="blog"]'
      )
      .forEach(function (item) {
        item.remove();
      });

    document
      .querySelectorAll(
        '[data-view-target="leads"], [data-view-target="pages"], [data-view-target="blog"], [data-view-target="guide"]'
      )
      .forEach(function (item) {
        item.remove();
      });

    ['leads', 'pages', 'blog', 'guide'].forEach(function (id) {
      var section = document.getElementById(id);
      if (section) section.remove();
    });

    var homeGrid = document.querySelector('#home .task-grid');
    if (homeGrid) {
      homeGrid.innerHTML = [
        {
          icon: '1',
          title: 'Tải ảnh lên thư viện',
          copy: 'Thêm ảnh từ máy, kiểm tra định dạng và lấy đường dẫn để dùng trong trang hoặc bài viết.',
          target: 'media',
          action: 'Mở thư viện ảnh',
        },
        {
          icon: '2',
          title: 'Kiểm tra trước khi public',
          copy: 'Đi qua checklist cuối: preview, SEO, ảnh, duyệt nội dung và hướng khôi phục.',
          target: 'deployments',
          action: 'Mở checklist',
        },
        {
          icon: '3',
          title: 'Ghi nhận lần kiểm tra live',
          copy: 'Lưu lại mốc kiểm tra trong trình duyệt để admin biết lần rà gần nhất.',
          target: 'history',
          action: 'Xem nhật ký',
        },
        {
          icon: '4',
          title: 'Xem cấu hình đã khóa',
          copy: 'Kiểm tra các phần server kiểm soát như session, nơi lưu dữ liệu, bảo vệ form và phục hồi.',
          target: 'settings',
          action: 'Mở cài đặt',
        },
      ]
        .map(function (item) {
          return (
            '<article class="task-card">' +
            '<div><div class="task-icon">' +
            item.icon +
            '</div><h3>' +
            item.title +
            '</h3><p>' +
            item.copy +
            '</p></div>' +
            '<button type="button" class="button" data-open-task="' +
            item.target +
            '">' +
            item.action +
            '</button></article>'
          );
        })
        .join('');

      homeGrid.querySelectorAll('[data-open-task]').forEach(function (button) {
        button.addEventListener('click', function () {
          var target = button.dataset.openTask;
          if (typeof setView === 'function') setView(target);
          else window.location.hash = target;
        });
      });
    }

    if (
      ['#leads', '#pages', '#blog', '#guide'].includes(window.location.hash)
    ) {
      history.replaceState(null, '', '#home');
      var home = document.getElementById('home');
      if (home) {
        document.querySelectorAll('[data-view]').forEach(function (view) {
          view.classList.toggle('active', view.id === 'home');
        });
        document.querySelectorAll('[data-view-target]').forEach(function (tab) {
          tab.classList.toggle('active', tab.dataset.viewTarget === 'home');
        });
      }
    }
  }

  window.FolksAdminSession = {
    showSessionExpired: showSessionExpired,
    loginUrl: loginUrl,
  };

  function checkSessionEarly() {
    if (window.location.pathname.endsWith('/admin/login.html')) return;
    nativeFetch('/api/admin-auth?check=session', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    })
      .then(function (response) {
        if (response.status === 401) showSessionExpired();
      })
      .catch(function () {
        // Network or configuration errors should not trap the editor on login.
      });
  }

  function addLogoutButtons() {
    tagAdminPage();
    setOfficialFavicon();
    makeBrandGoHome();
    simplifyAdminNav();
    simplifyAdminHome();
    simplifyConsolePage();
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
