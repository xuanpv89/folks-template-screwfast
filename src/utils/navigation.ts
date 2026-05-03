const navBarLinks = [
  { name: 'Home', url: '/' },
  {
    name: 'C.H.E.S.S',
    url: '/chess',
    children: [
      { name: 'Compassio', url: '/compassio' },
      { name: 'Case Study', url: '/case-studies/dancenter-chess' },
    ],
  },
  { name: 'Services', url: '/services' },
  { name: 'Products', url: '/products' },
  { name: 'Blog', url: '/blog' },
  { name: 'Help', url: '/guides/getting-started/' },
  { name: 'Contact', url: '/contact' },
];

const footerLinks = [
  {
    section: 'Explore',
    links: [
      { name: 'C.H.E.S.S Model', url: '/chess' },
      { name: 'Compassio', url: '/compassio' },
      { name: 'Products', url: '/products' },
      { name: 'Services', url: '/services' },
      { name: 'Case Studies', url: '/case-studies/dancenter-chess' },
    ],
  },
  {
    section: 'Resources',
    links: [
      { name: 'Blog', url: '/blog' },
      { name: 'Guides', url: '/guides/getting-started/' },
      { name: 'Docs Home', url: '/welcome-to-docs/' },
    ],
  },
  {
    section: 'Company',
    links: [
      { name: 'About Us', url: '/about' },
      { name: 'Team', url: '/about#team' },
      { name: 'Contact', url: '/contact' },
    ],
  },
  {
    section: 'Contact',
    links: [
      { name: 'contact@folksteam.com', url: 'mailto:contact@folksteam.com' },
      { name: '50 Quach Giai, Cat Lai, HCMC', url: '/contact' },
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
