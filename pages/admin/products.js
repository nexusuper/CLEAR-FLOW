import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';

const ProductsPanel = dynamic(() => import('@/components/admin/ProductsPanel'), { ssr: false });

export default function AdminProductsPage() {
  return (
    <AdminLayout title="Products & Pricing">
      <ProductsPanel />
    </AdminLayout>
  );
}
