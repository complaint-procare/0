import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { Layout } from '@/components/Layout'
import { SettingsLayout } from '@/components/SettingsLayout'
import { LoginPage } from '@/pages/Login'
import { ComplaintsPage } from '@/pages/Complaints'
import { NewComplaintPage } from '@/pages/NewComplaint'
import { ComplaintDetailsPage } from '@/pages/ComplaintDetails'
import { AnalyticsPage } from '@/pages/Analytics'
import { BoxesPage } from '@/pages/Boxes'
import { ClientsPage } from '@/pages/admin/Clients'
import { BrandsPage } from '@/pages/admin/Brands'
import { ProductsPage } from '@/pages/admin/Products'
import { NetworksPage } from '@/pages/admin/Networks'
import { UsersPage } from '@/pages/admin/Users'
import { EntitiesPage } from '@/pages/admin/Entities'
import { FieldsPage } from '@/pages/admin/Fields'
import { SettingsPage } from '@/pages/admin/Settings'
import { StatusesPage } from '@/pages/admin/Statuses'

function ProtectedRoutes() {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Завантаження…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return (
    <Layout>
      <Routes>
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/boxes" element={<BoxesPage />} />
        <Route path="/complaints/new" element={<NewComplaintPage />} />
        <Route path="/complaints/:id" element={<ComplaintDetailsPage />} />

        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/clients" replace />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="networks" element={<NetworksPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="entities" element={<EntitiesPage />} />
          <Route path="fields" element={<FieldsPage />} />
          <Route path="statuses" element={<StatusesPage />} />
          <Route path="general" element={<SettingsPage />} />
        </Route>

        <Route path="/clients" element={<Navigate to="/settings/clients" replace />} />
        <Route path="/brands" element={<Navigate to="/settings/brands" replace />} />
        <Route path="/products" element={<Navigate to="/settings/products" replace />} />
        <Route path="/retail-networks" element={<Navigate to="/settings/networks" replace />} />
        <Route path="/admin/users" element={<Navigate to="/settings/users" replace />} />
        <Route path="/admin/entities" element={<Navigate to="/settings/entities" replace />} />
        <Route path="/admin/fields" element={<Navigate to="/settings/fields" replace />} />
        <Route path="/admin/statuses" element={<Navigate to="/settings/statuses" replace />} />
        <Route path="/admin/settings" element={<Navigate to="/settings/general" replace />} />

        <Route path="*" element={<Navigate to="/complaints" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}
