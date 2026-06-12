import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';

const PosPanel = dynamic(() => import('@/components/admin/PosPanel'), { ssr: false });

export default function AdminPosPage() {
  return (
    <AdminLayout title="Walk-in Sale (POS)">
      <PosPanel />
    </AdminLayout>
  );
}
