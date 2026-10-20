import { useEffect } from 'react';
import { useApp } from './lib/app';
import { matchRoute, navigate, useLocation } from './lib/router';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Collection, RecordPayment, Payments, Receipt, History } from './pages/Rent';
import { Malls, MallView, MallForm, Sections, SectionEdit } from './pages/Malls';
import { Rooms, RoomView, RoomForm } from './pages/Rooms';
import { Apartments, ApartmentView, ApartmentForm, Lands, LandView, LandForm } from './pages/Units';
import { Tenants, TenantView, TenantForm } from './pages/Tenants';
import { Expenses, ExpenseEdit } from './pages/Expenses';
import { ReportMonthly, ReportMalls, ReportApartments, Statements, Statement } from './pages/Reports';
import { Users, UserForm, Settings } from './pages/Admin';
import { HR, StaffForm } from './pages/HR';

const ROUTES = [
  ['/', Dashboard],
  ['/collection', Collection],
  ['/payments/new', RecordPayment],
  ['/payments', Payments],
  ['/receipts/:id', Receipt],
  ['/history', History],
  ['/malls', Malls], ['/malls/new', MallForm], ['/malls/:id/edit', MallForm], ['/malls/:id/sections', Sections], ['/malls/:id', MallView],
  ['/sections/:id', SectionEdit],
  ['/rooms', Rooms], ['/rooms/new', RoomForm], ['/rooms/:id/edit', RoomForm], ['/rooms/:id', RoomView],
  ['/apartments', Apartments], ['/apartments/new', ApartmentForm], ['/apartments/:id/edit', ApartmentForm], ['/apartments/:id', ApartmentView],
  ['/lands', Lands], ['/lands/new', LandForm], ['/lands/:id/edit', LandForm], ['/lands/:id', LandView],
  ['/tenants', Tenants], ['/tenants/new', TenantForm], ['/tenants/:id/edit', TenantForm], ['/tenants/:id', TenantView],
  ['/expenses', Expenses], ['/expenses/:id/edit', ExpenseEdit],
  ['/reports', ReportMonthly], ['/reports/malls', ReportMalls], ['/reports/apartments', ReportApartments],
  ['/statements', Statements], ['/statements/:year/:month', Statement],
  ['/users', Users], ['/users/new', UserForm], ['/users/:id/edit', UserForm],
  ['/settings', Settings],
  ['/hr', HR], ['/hr/staff/new', StaffForm], ['/hr/staff/:id/edit', StaffForm],
];

export default function App() {
  const { meta } = useApp();
  const loc = useLocation();

  useEffect(() => {
    if (meta === false && loc.path !== '/login') navigate('/login?next=' + encodeURIComponent(loc.path + loc.search), { replace: true });
    if (meta && loc.path === '/login') navigate('/', { replace: true });
  }, [meta, loc.path, loc.search]);

  if (meta === null) return <Loading />;
  if (meta === false || loc.path === '/login') return meta === false ? <Login /> : <Loading />;

  const match = matchRoute(ROUTES, loc.path);
  if (!match) {
    return <Layout title="Not found"><div className="card"><div className="card-body text-center py-5"><h2 className="h5">Page not found</h2><a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Back to Dashboard</a></div></div></Layout>;
  }
  const { Component, params } = match;
  return <Component key={loc.path} params={params} query={loc.query} />;
}
