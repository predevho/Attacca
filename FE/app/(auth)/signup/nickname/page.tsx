import { NicknameForm } from './NicknameForm';

export default async function NicknamePage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <NicknameForm next={next ?? null} />;
}
