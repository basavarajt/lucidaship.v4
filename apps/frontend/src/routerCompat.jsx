import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const RouterContext = createContext({ pathname: '/', navigate: () => {} });

function safePath(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return '/';
  }
  return target;
}

export function BrowserRouter({ children }) {
  const [pathname, setPathname] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const value = useMemo(() => ({
    pathname,
    navigate: (target, options = {}) => {
      const nextPath = safePath(target);
      if (options.replace) window.history.replaceState({}, '', nextPath);
      else window.history.pushState({}, '', nextPath);
      setPathname(nextPath);
    },
  }), [pathname]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function Route() {
  return null;
}

function matches(path, pathname) {
  if (path === '*') return true;
  if (path.endsWith('/*')) return pathname === path.slice(0, -2) || pathname.startsWith(path.slice(0, -1));
  return path === pathname;
}

export function Routes({ children }) {
  const { pathname } = useContext(RouterContext);
  const route = useMemo(
    () => (Array.isArray(children) ? children : [children]).find(
      (child) => child?.props && matches(child.props.path, pathname),
    ),
    [children, pathname],
  );
  return route?.props?.element ?? null;
}

export function Navigate({ to, replace = true }) {
  const { navigate } = useContext(RouterContext);
  useEffect(() => { navigate(to, { replace }); }, [navigate, replace, to]);
  return null;
}

export function Link({ to, onClick, ...props }) {
  const { navigate } = useContext(RouterContext);
  const href = safePath(to);
  return <a {...props} href={href} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }} />;
}

export function useNavigate() {
  return useContext(RouterContext).navigate;
}
