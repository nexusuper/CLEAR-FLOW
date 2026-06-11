import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';

const ReportsPanel = dynamic(() => import('@/components/admin/ReportsPanel'), { ssr: false });

export default function AdminReportsPage() {
  return (
    <AdminLayout title="Reports">
      <ReportsPanel />
    </AdminLayout>
  );
}
