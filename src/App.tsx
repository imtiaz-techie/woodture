import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout, { ScrollToTop } from './components/Layout';
import { PageLoader } from './components/ui';
import { AuthProvider } from './context/Auth';
import { ShopProvider } from './context/Shop';
import { StoreProvider } from './context/Store';
import Home from './pages/Home';

// Everything except the homepage is code-split so the first paint stays fast.
const Shop = lazy(() => import('./pages/Shop'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Account = lazy(() => import('./pages/Account'));
const page = <T extends Record<string, any>, K extends keyof T>(load: () => Promise<T>, name: K) => lazy(() => load().then(m => ({ default: m[name] as T[K] })));

const orders = () => import('./pages/Orders');
const OrderPage = page(orders, 'OrderPage');
const TrackPage = page(orders, 'TrackPage');
const auth = () => import('./pages/AuthPages');
const Login = page(auth, 'Login');
const Register = page(auth, 'Register');
const ForgotPassword = page(auth, 'ForgotPassword');
const ResetPassword = page(auth, 'ResetPassword');
const content = () => import('./pages/Content');
const Collections = page(content, 'Collections');
const Wishlist = page(content, 'Wishlist');
const Gallery = page(content, 'Gallery');
const About = page(content, 'About');
const Contact = page(content, 'Contact');
const Policy = page(content, 'Policy');
const NotFound = page(content, 'NotFound');

const adminLayout = () => import('./admin/AdminLayout');
const AdminLayout = lazy(adminLayout);
const AdminLogin = page(adminLayout, 'AdminLogin');
const Overview = lazy(() => import('./admin/Overview'));
const adminProducts = () => import('./admin/Products');
const ProductsList = page(adminProducts, 'ProductsList');
const ProductForm = page(adminProducts, 'ProductForm');
const AdminOrders = lazy(() => import('./admin/Orders'));
const adminCatalog = () => import('./admin/Catalog');
const Categories = page(adminCatalog, 'Categories');
const Inventory = page(adminCatalog, 'Inventory');
const adminManage = () => import('./admin/Manage');
const Customers = page(adminManage, 'Customers');
const Payments = page(adminManage, 'Payments');
const Coupons = page(adminManage, 'Coupons');
const Reviews = page(adminManage, 'Reviews');
const Messages = page(adminManage, 'Messages');
const AdminProfile = page(adminManage, 'AdminProfile');
const adminSite = () => import('./admin/Site');
const GalleryAdmin = page(adminSite, 'GalleryAdmin');
const HomepageAdmin = page(adminSite, 'HomepageAdmin');
const SettingsAdmin = page(adminSite, 'SettingsAdmin');

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <ShopProvider>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/collections" element={<Collections />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/new-arrivals" element={<Shop preset="new" />} />
                  <Route path="/product/:slug" element={<ProductPage />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/order/:number" element={<OrderPage />} />
                  <Route path="/track" element={<TrackPage />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/gallery" element={<Gallery />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/privacy" element={<Policy kind="privacy" />} />
                  <Route path="/terms" element={<Policy kind="terms" />} />
                  <Route path="/shipping-returns" element={<Policy kind="shipping" />} />
                  <Route path="*" element={<NotFound />} />
                </Route>

                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<Overview />} />
                  <Route path="products" element={<ProductsList />} />
                  <Route path="products/new" element={<ProductForm />} />
                  <Route path="products/:id" element={<ProductForm />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="inventory" element={<Inventory />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="coupons" element={<Coupons />} />
                  <Route path="reviews" element={<Reviews />} />
                  <Route path="gallery" element={<GalleryAdmin />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="homepage" element={<HomepageAdmin />} />
                  <Route path="settings" element={<SettingsAdmin />} />
                  <Route path="profile" element={<AdminProfile />} />
                </Route>
              </Routes>
            </Suspense>
          </ShopProvider>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
