import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';

const OrdersManager = dynamic(() => import('@/components/admin/OrdersManager'), { ssr: false });

export default function AdminOrdersPage() {
  return (
    <AdminLayout title="Orders">
      <OrdersManager />
    </AdminLayout>
  );
}
