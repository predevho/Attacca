import LegalDocument from '../LegalDocument';
import { PRIVACY } from '@/lib/legal/policy';

export const metadata = { title: '개인정보처리방침 · Attacca' };

export default function PrivacyPage() {
  return <LegalDocument title="개인정보처리방침" sections={PRIVACY} />;
}
