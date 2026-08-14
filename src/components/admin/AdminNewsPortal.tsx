import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminNewsManager from './AdminNewsManager';

function useAdminNewsMount(pathname: string) {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const normalized = pathname.replace(/\/+$/, '');
    if (!(normalized === '/admin/news' || normalized.startsWith('/admin/news/'))) {
      setMount(null);
      return undefined;
    }

    const node = document.createElement('div');
    node.className = 'd68-admin-news-portal-mount';
    let observer: MutationObserver | null = null;
    let attached = false;

    const attach = () => {
      const main = document.querySelector<HTMLElement>('.d68-admin-cols > main');
      if (!main) return false;
      main.appendChild(node);
      attached = true;
      setMount(node);
      return true;
    };

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer?.disconnect();
      if (attached && node.parentNode) node.parentNode.removeChild(node);
      setMount(null);
    };
  }, [pathname]);

  return mount;
}

export default function AdminNewsPortal() {
  const { profile } = useAuth();
  const location = useLocation();
  const mount = useAdminNewsMount(location.pathname);
  if (!mount || profile?.role !== 'admin' || !profile.id) return null;
  return createPortal(<AdminNewsManager />, mount);
}
