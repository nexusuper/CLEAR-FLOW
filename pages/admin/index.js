import dynamic from 'next/dynamic';

const AdminPanel = dynamic(() => import('@/components/AdminPanel'), { ssr: false });

export default function AdminPage() {
  return <AdminPanel />;
}
