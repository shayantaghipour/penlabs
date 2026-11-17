export type Section = {
  id: number;
  name: string;
  color: string;
  position: number;
};

export type Note = {
  id: number;
  section_id: number;
  title: string;
  content: string;
  updated_at: number; // میلی‌ثانیه
  pinned: boolean;
  deleted_at: number | null; // اگه null نباشه، تو سطل زباله‌ست
};