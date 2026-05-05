import cmsContent from '@data/cmsContent.json';

export function GET() {
  return new Response(JSON.stringify(cmsContent), {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
