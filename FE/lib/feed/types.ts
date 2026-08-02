export type Author = { id: number; nickname: string; verified: boolean };

export type Post = {
  id: number;
  author: Author;
  content: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Comment = {
  id: number;
  postId: number;
  author: Author;
  content: string;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
};

export type CursorPage<T> = { items: T[]; nextCursor: number | null };

export type Me = { id: number; nickname: string; role: 'USER' | 'ADMIN'; verified: boolean };

export type Likeable = { id: number; likeCount: number; likedByMe: boolean };
