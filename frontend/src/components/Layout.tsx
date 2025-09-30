import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

const NavLink = ({ to, children }: { to: string, children: React.ReactNode }) => {
    const location = useLocation();
    const isActive = location.pathname === to || (to === '/' && location.pathname === '/dashboard'); // Handle dashboard as root
    return (
        <li className="nav-item">
            <Link className={`nav-link ${isActive ? 'active' : ''}`} to={to}>{children}</Link>
        </li>
    );
}

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-container">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css"></link>

      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">Apotek POS</Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                <NavLink to="/">Dashboard</NavLink>
                <NavLink to="/cashier">Kasir</NavLink>
                <NavLink to="/products">Manajemen Produk</NavLink>
                <NavLink to="/prescriptions">Manajemen Resep</NavLink>
                <NavLink to="/promotions">Manajemen Promo</NavLink>
                <NavLink to="/history">Riwayat Penjualan</NavLink> {/* Link baru */}
            </ul>
            <button className="btn btn-outline-light" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>
      <main className="main-content-area">
        <Outlet />
      </main>
    </div>
  );
}
