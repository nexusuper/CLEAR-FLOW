import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';

const InventoryPanel = dynamic(() => import('@/components/admin/InventoryPanel'), { ssr: false });

export default function AdminInventoryPage() {
  return (
    <AdminLayout title="Inventory">
      <InventoryPanel />
    </AdminLayout>
  );
}
