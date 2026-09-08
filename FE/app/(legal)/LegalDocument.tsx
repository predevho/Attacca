import type { Section } from '@/lib/legal/policy';
import { POLICY_VERSION } from '@/lib/legal/policy';

/** 약관·개인정보처리방침 공통 레이아웃. 두 문서의 생김새를 한 곳에서 정한다. */
export default function LegalDocument({ title, sections }: { title: string; sections: Section[] }) {
  return (
    <main className="mx-auto my-16 max-w-2xl px-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted">버전 {POLICY_VERSION}</p>

      {sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-base font-semibold">{s.heading}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed">{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
