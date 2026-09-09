/**
 * 표시에 필요한 것만 받는다. 회원 id를 요구하지 않는 이유는 공개 응답에 id가
 * 없기 때문이다(PublicMemberDisplay) — 공개 화면에서도 같은 배지를 쓴다.
 */
// id는 있어도 되고 없어도 된다 — 이 배지는 쓰지 않는다.
type Displayable = { id?: number; nickname: string; verified: boolean };

export function AuthorBadge({ author }: { author: Displayable }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-medium">{author.nickname}</span>
      {author.verified && (
        <span className="rounded-full bg-brand px-1.5 py-0.5 text-xs text-on-brand">인증</span>
      )}
    </span>
  );
}
