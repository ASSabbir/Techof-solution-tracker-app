'use client';
import { useParams } from 'next/navigation';
import ProfileView from '@/components/ProfileView';

export default function MemberProfilePage() {
  const { id } = useParams();
  return <ProfileView id={id} />;
}
