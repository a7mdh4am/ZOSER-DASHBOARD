import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { Spinner } from "./components/ui.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import Coupons from "./pages/Coupons.jsx";
import Customers from "./pages/Customers.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Designer from "./pages/Designer.jsx";
import Finance from "./pages/Finance.jsx";
import Login from "./pages/Login.jsx";
import OrderDetail from "./pages/OrderDetail.jsx";
import Orders from "./pages/Orders.jsx";
import Products from "./pages/Products.jsx";
import Roles from "./pages/Roles.jsx";
import Settings from "./pages/Settings.jsx";
import Team from "./pages/Team.jsx";
import Themes from "./pages/Themes.jsx";

export default function App() {
  const { user, ready, can } = useAuth();

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
