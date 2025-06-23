export interface Posts {
  id: string;
  title: string;
  content: string | null;
  user_id: string | null;
  published: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface Database {
  Posts: Posts;
}

