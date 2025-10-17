import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Browse from './pages/Browse';
import Login from './pages/Login';
import Register from './pages/Register';
import NewListing from './pages/NewListing';
import ListingDetail from './pages/ListingDetail';
import Dashboard from './pages/Dashboard';
import Inbox from './pages/Inbox';
import MySwaps from "./pages/MySwaps";
import Admin from './pages/Admin';
import { RequireRole } from "./auth/guards";

export default function App(){
  return (
    <Routes>
      <Route path="/" element={<Home/>} />
      <Route path="/browse" element={<Browse/>} />
      <Route path="/login" element={<Login/>} />
      <Route path="/register" element={<Register/>} />
      <Route path="/new" element={<NewListing/>} />
      <Route path="/listing/:id" element={<ListingDetail/>} />
      <Route path="/dashboard" element={<Dashboard/>} />
      <Route path="/inbox" element={<Inbox/>} />
      <Route path="/swaps" element={<MySwaps />} />

      {/* ✅ New Admin Route */}
      <Route
        path="/admin"
        element={
          <RequireRole roles={['app_admin']}>
            <Admin />
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/"/>} />
    </Routes>
  );
}
