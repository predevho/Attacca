import LegalDocument from '../LegalDocument';
import { TERMS } from '@/lib/legal/policy';

export const metadata = { title: '이용약관 · Attacca' };

export default function TermsPage() {
  return <LegalDocument title="이용약관" sections={TERMS} />;
}
