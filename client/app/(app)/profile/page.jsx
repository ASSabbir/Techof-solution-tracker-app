'use client';
import ProfileView from '@/components/ProfileView';
import { useAuth } from '@/components/contexts';

export default function MyProfilePage() {
  const { user } = useAuth();
  return <ProfileView id={user._id} />;
}
