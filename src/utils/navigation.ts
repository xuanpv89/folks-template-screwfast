const navBarLinks = [
  { name: 'Homes', url: '/' },
  {
    name: 'C.H.E.S.S',
    url: '/chess',
    children: [{ name: 'Compassio', url: '/compassio' }],
  },
  { name: 'Services', url: '/services' },
  { name: 'Products', url: '/products' },
  { name: 'Blog', url: '/blog' },
  { name: 'Help', url: '/guides/getting-started/' },
  { name: 'Contact', url: '/contact' },
];

const footerLinks = [
  {
    section: 'Product',
    links: [
      { name: 'Framework', url: '/products' },
      { name: 'Systems', url: '#features' },
      { name: 'Security', url: '#' },
      { name: 'Team', url: '#' },
      { name: 'Enterprise', url: '#' },
      { name: 'Case Studies', url: '#' },
      { name: 'Pricing', url: '#' },
    ],
  },
  {
    section: 'Resources',
    links: [
      { name: 'Platform', url: '#' },
      { name: 'Developer API', url: '#' },
      { name: 'Partners', url: '#' },
      { name: 'Guides', url: '/welcome-to-docs/' },
      { name: 'Community', url: '#' },
    ],
  },
  {
    section: 'Support',
    links: [
      { name: 'Docs', url: '/welcome-to-docs/' },
      { name: 'Forum', url: '#' },
      { name: 'Professional Services', url: '/services' },
      { name: 'Workflows', url: '#' },
      { name: 'Status', url: '#' },
      { name: 'Contact', url: '/contact' },
    ],
  },
  {
    section: 'Company',
    links: [
      { name: 'About', url: '#' },
      { name: 'Blog', url: '/blog' },
      { name: 'Careers', url: '#' },
      { name: 'Press', url: '#' },
      { name: 'Impact', url: '#' },
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
