
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
    const token = localStorage.getItem('authToken');

    // Jika token tidak ada, arahkan ke halaman login
    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // Jika token ada, tampilkan konten yang diminta (melalui Outlet)
    return <Outlet />;
};

export default ProtectedRoute;
