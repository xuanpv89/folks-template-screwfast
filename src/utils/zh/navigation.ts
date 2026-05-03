const navBarLinks = [
  { name: '首页', url: '/zh' },
  {
    name: 'C.H.E.S.S',
    url: '/zh/chess',
    children: [
      { name: 'Compassio', url: '/zh/compassio' },
      { name: '案例研究', url: '/case-studies/dancenter-chess' },
    ],
  },
  { name: '服务', url: '/zh/services' },
  { name: '产品', url: '/zh/products' },
  { name: '博客', url: '/zh/blog' },
  { name: '指南', url: '/zh/guides/getting-started/' },
  { name: '联系', url: '/zh/contact' },
];

const footerLinks = [
  {
    section: '探索',
    links: [
      { name: 'C.H.E.S.S 模型', url: '/zh/chess' },
      { name: 'Compassio', url: '/zh/compassio' },
      { name: '产品', url: '/zh/products' },
      { name: '服务', url: '/zh/services' },
      { name: '案例研究', url: '/case-studies/dancenter-chess' },
    ],
  },
  {
    section: '资源',
    links: [
      { name: '博客', url: '/zh/blog' },
      { name: '指南', url: '/zh/guides/getting-started/' },
      { name: '文档首页', url: '/zh/welcome-to-docs/' },
    ],
  },
  {
    section: '公司',
    links: [
      { name: '关于我们', url: '/zh/about' },
      { name: '团队', url: '/zh/about#team' },
      { name: '联系', url: '/zh/contact' },
    ],
  },
];

const socialLinks = {
  facebook: 'https://www.facebook.com/',
  x: 'https://twitter.com/',
  github: 'https://github.com/xuanpv89/folks-template-screwfast',
  google: 'https://www.google.com/',
  slack: 'https://slack.com/',
};

export default {
  navBarLinks,
  footerLinks,
  socialLinks,
};
