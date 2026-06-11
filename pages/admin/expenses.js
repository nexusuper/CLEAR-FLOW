import dynamic from 'next/dynamic';
import AdminLayout from '@/components/admin/AdminLayout';

const ExpensesPanel = dynamic(() => import('@/components/admin/ExpensesPanel'), { ssr: false });

export default function AdminExpensesPage() {
  return (
    <AdminLayout title="Expenses">
      <ExpensesPanel />
    </AdminLayout>
  );
}
