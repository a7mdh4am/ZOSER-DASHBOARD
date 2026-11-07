import { lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { useAuth } from "./context/auth.js";
import Login from "./pages/Login.jsx";

// Each page's code is downloaded the first time it's opened, so the first
// screen only waits for what it shows. (Sign-in stays in the main bundle: it's
// what signed-out visitors see first.) Layout shows a spinner meanwhile.

// Pages already downloaded (opened before, preloaded or prefetched).
const loadedPages = {};
const pageLoaders = Object.fromEntries(
  Object.entries({
    Coupons: () => import("./pages/Coupons.jsx"),
    Customers: () => import("./pages/Customers.jsx"),
    Dashboard: () => import("./pages/Dashboard.jsx"),
    Designer: () => import("./pages/Designer.jsx"),
    Finance: () => import("./pages/finance/index.jsx"),
    OrderDetail: () => import("./pages/order-detail/index.jsx"),
    Orders: () => import("./pages/Orders.jsx"),
    Products: () => import("./pages/products/index.jsx"),
    Roles: () => import("./pages/Roles.jsx"),
    Settings: () => import("./pages/Settings.jsx"),
    Team: () => import("./pages/Team.jsx"),
    Themes: () => import("./pages/Themes.jsx"),
  }).map(([name, load]) => [
    name,
    () =>
      load().then((module) => {
        loadedPages[name] = module.default;
        return module;
      }),
  ]),
);

// Start downloading the page being opened right away, alongside the sign-in
// check, rather than after it.
const PAGE_FOR_PATH = [
  ["/orders/", "OrderDetail"],
  ["/orders", "Orders"],
  ["/designer", "Designer"],
  ["/customers", "Customers"],
  ["/themes", "Themes"],
  ["/products", "Products"],
  ["/coupons", "Coupons"],
  ["/finance", "Finance"],
  ["/team", "Team"],
  ["/roles", "Roles"],
  ["/settings", "Settings"],
];
const openingPage =
  window.location.pathname === "/"
    ? "Dashboard"
    : PAGE_FOR_PATH.find(([path]) =>
        window.location.pathname.startsWith(path),
      )?.[1];
if (openingPage) pageLoaders[openingPage]().catch(() => {});

/**
 * A route's page. React.lazy suspends at least once even when the code is
 * already here, which flashes the loading spinner and holds the page back for
 * a moment; a page that has been downloaded renders straight away instead.
 */
function lazyPage(name) {
  const Lazy = lazy(pageLoaders[name]);
  return function Page() {
    const [Component] = useState(() => loadedPages[name] ?? Lazy);
    return <Component />;
  };
}

const Coupons = lazyPage("Coupons");
const Customers = lazyPage("Customers");
const Dashboard = lazyPage("Dashboard");
const Designer = lazyPage("Designer");
const Finance = lazyPage("Finance");
const OrderDetail = lazyPage("OrderDetail");
const Orders = lazyPage("Orders");
const Products = lazyPage("Products");
const Roles = lazyPage("Roles");
const Settings = lazyPage("Settings");
const Team = lazyPage("Team");
const Themes = lazyPage("Themes");

// Once signed in and the browser is idle, fetch the other pages in the
// background, so opening one later doesn't wait on the network.
function usePrefetchPages(signedIn) {
  useEffect(() => {
    if (!signedIn) return;
    const prefetch = () =>
      Object.values(pageLoaders).forEach((load) => load().catch(() => {}));
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(prefetch, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 2000); // Safari has no requestIdleCallback
    return () => clearTimeout(id);
  }, [signedIn]);
}

export default function App() {
  const { user, ready, can } = useAuth();
  usePrefetchPages(Boolean(user));

  if (!ready) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  // First landing page the role is allowed to see.
  const home = can("dashboard.view")
    ? "/"
    : can("orders.view")
      ? "/orders"
      : can("designer.view")
        ? "/designer"
        : can("customers.view")
          ? "/customers"
          : can("themes.view")
            ? "/themes"
            : can("products.view")
              ? "/products"
              : can("coupons.view")
                ? "/coupons"
                : can("finance.view")
                  ? "/finance"
                  : can("team.manage")
                    ? "/team"
                    : can("roles.manage")
                      ? "/roles"
                      : "/settings";

  return (
    <Routes>
      <Route element={<Layout />}>
        {can("dashboard.view") && <Route path="/" element={<Dashboard />} />}
        {can("orders.view") && <Route path="/orders" element={<Orders />} />}
        {can("orders.view") && (
          <Route path="/orders/:id" element={<OrderDetail />} />
        )}
        {can("designer.view") && (
          <Route path="/designer" element={<Designer />} />
        )}
        {can("customers.view") && (
          <Route path="/customers" element={<Customers />} />
        )}
        {can("themes.view") && <Route path="/themes" element={<Themes />} />}
        {can("products.view") && (
          <Route path="/products" element={<Products />} />
        )}
        {can("coupons.view") && <Route path="/coupons" element={<Coupons />} />}
        {can("finance.view") && <Route path="/finance" element={<Finance />} />}
        {can("team.manage") && <Route path="/team" element={<Team />} />}
        {can("roles.manage") && <Route path="/roles" element={<Roles />} />}
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}
