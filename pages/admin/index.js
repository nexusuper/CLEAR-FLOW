import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';

const Dashboard = dynamic(() => import('@/components/admin/Dashboard'), { ssr: false });

export default function AdminDashboardPage() {
  return (
    <AdminLayout title="Dashboard">
      <Dashboard />
    </AdminLayout>
  );
}
