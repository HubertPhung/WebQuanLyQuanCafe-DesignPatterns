// Keep old seed URLs from persisted data and carts on the bundled copies as well.
const catalogPhotos = new Set([
  'photo-1442512595331-e89e73853f31',
  'photo-1447933601403-0c6688de566e',
  'photo-1495474472287-4d71bcdd2085',
  'photo-1497034825429-c343d7c6a68f',
  'photo-1497636577773-f1231844b336',
  'photo-1498804103079-a6351b050096',
  'photo-1499638673689-79a0b5115d87',
  'photo-1501339847302-ac426a4a7cbb',
  'photo-1501386761578-eac5c94b800a',
  'photo-1508766917616-d22f3f1eea14',
  'photo-1509440159596-0249088772ff',
  'photo-1511920170033-f8396924c348',
  'photo-1514432324607-a09d9b4aefdd',
  'photo-1517248135467-4c7edcad34c4',
  'photo-1517256064527-09c73fc73e38',
  'photo-1517701550927-30cf4ba1dba5',
  'photo-1521017432531-fbd92d768814',
  'photo-1524350876685-274059332603',
  'photo-1525610553991-2bede1a236e2',
  'photo-1529972016098-9407f216972e',
  'photo-1534778101976-62847782c213',
  'photo-1554118811-1e0d58224f24',
  'photo-1555507036-ab1f4038808a',
  'photo-1556679343-c7306c1976bc',
  'photo-1559925393-8be0ec4767c8',
  'photo-1562447457-579fc34967fb',
  'photo-1571877227200-a0d98ea607e9',
  'photo-1580933073521-dc49ac0d4e6a',
  'photo-1592663527359-cf6642f54cff',
  'photo-1593443320739-77f74939d0da',
  'photo-1600093463592-8e36ae95ef56',
  'photo-1607958996333-41aef7caefaa',
  'photo-1610882648335-ced8fc8fa6b6',
  'photo-1610889556528-9a770e32642f',
  'photo-1676300185983-d5f242babe34',
  'photo-1696487773677-c0c8061fe3d2',
  'photo-1700937244987-92488ab2ada5',
  'photo-1717603545758-88cc454db69b',
  'photo-1718267050202-9b1b6bfb8545',
  'photo-1751569543716-70c5fb9a8298',
  'photo-1761344788266-5f6957aeea33',
])

export function isLocalImageSource(value: string): boolean {
  return (value.startsWith('/') && !value.startsWith('//') && !/[\\\s]/.test(value))
    || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value)
}

export function localImageSrc(value: string | null | undefined, fallback = '/placeholder.svg'): string {
  const source = value?.trim() ?? ''
  if (isLocalImageSource(source)) return source
  if (!source) return fallback
  try {
    const url = new URL(source)
    // Table photos uploaded on a dev machine were saved with an absolute localhost URL.
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.pathname === '/api/table-images') {
      return `${url.pathname}${url.search}`
    }
    if (url.hostname === 'images.unsplash.com') {
      const photo = url.pathname.slice(1)
      if (catalogPhotos.has(photo)) return `/images/catalog/${photo}.jpg`
      // This original photo was removed upstream; use the bundled counter photo.
      if (photo === 'photo-1445116572660-238429888876') return '/images/space/counter.jpg'
    }
  } catch {
    // Invalid or external image sources use a bundled placeholder.
  }
  return fallback
}
