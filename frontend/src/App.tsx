
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import Cashier from "./components/Cashier";
import ProductManagement from "./components/ProductManagement";
import PrescriptionManagement from "./components/PrescriptionManagement";
import SalesHistory from "./components/SalesHistory";
import Login from "./components/Login"; // Import Login component
import ProtectedRoute from "./components/ProtectedRoute"; // Import ProtectedRoute component

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rute publik untuk login */}
        <Route path="/login" element={<Login />} />

        {/* Rute yang dilindungi */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="cashier" element={<Cashier />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="prescriptions" element={<PrescriptionManagement />} />
            <Route path="history" element={<SalesHistory />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
