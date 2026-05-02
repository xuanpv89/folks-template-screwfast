const navBarLinks = [
  { name: 'Trang chủ', url: '/vi' },
  { name: 'Sản phẩm', url: '/vi/products' },
  { name: 'CHESS', url: '/vi/chess' },
  { name: 'Dịch vụ', url: '/vi/services' },
  { name: 'Blog', url: '/vi/blog' },
  { name: 'Liên hệ', url: '/vi/contact' },
];

const footerLinks = [
  {
    section: 'Sản phẩm',
    links: [
      { name: 'Framework', url: '/vi/products' },
      { name: 'Hệ thống', url: '/vi#features' },
      { name: 'Bảo mật', url: '#' },
      { name: 'Đội ngũ', url: '#' },
      { name: 'Doanh nghiệp', url: '#' },
      { name: 'Case Studies', url: '#' },
      { name: 'Pricing', url: '#' },
    ],
  },
  {
    section: 'Tài nguyên',
    links: [
      { name: 'Nền tảng', url: '#' },
      { name: 'Developer API', url: '#' },
      { name: 'Đối tác', url: '#' },
      { name: 'Hướng dẫn', url: '/vi/welcome-to-docs/' },
      { name: 'Cộng đồng', url: '#' },
    ],
  },
  {
    section: 'Hỗ trợ',
    links: [
      { name: 'Docs', url: '/vi/welcome-to-docs/' },
      { name: 'Forum', url: '#' },
      { name: 'Dịch vụ', url: '/vi/services' },
      { name: 'Workflows', url: '#' },
      { name: 'Trạng thái', url: '#' },
      { name: 'Liên hệ', url: '/vi/contact' },
    ],
  },
  {
    section: 'Công ty',
    links: [
      { name: 'About', url: '#' },
      { name: 'Blog', url: '/vi/blog' },
      { name: 'Careers', url: '#' },
      { name: 'Press', url: '#' },
      { name: 'Impact', url: '#' },
    ],
  },
];

const socialLinks = {
  facebook: '#',
  x: '#',
  github: 'https://github.com/xuanpv89/folks-template-screwfast',
  google: '#',
  slack: '#',
};

export default {
  navBarLinks,
  footerLinks,
  socialLinks,
};
