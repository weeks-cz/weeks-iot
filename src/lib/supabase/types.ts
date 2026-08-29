/**
 * Typy databáze.
 *
 * Psané ručně podle supabase/migrations/001–003. Až projekt poběží, jde je
 * nahradit generovanými:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
 *
 * Do té doby platí: kdo mění migraci, mění i tenhle soubor.
 */

export type ConsentKind = "terms" | "parental" | "marketing";
export type ProgressStatus = "started" | "completed";
export type ProjectKind = "circuit" | "model" | "code";
export type Plan = "free" | "premium";

export type RegionRow = {
  code: string;
  name: string;
  is_camp_catchment: boolean;
  sort_order: number;
}

export type ParentRow = {
  id: string;
  email: string;
  region_code: string | null;
  onboarding_completed_at: string | null;
  plan: Plan;
  plan_expires_at: string | null;
  premium_activated_at: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
  deletion_requested_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ConsentRow = {
  id: number;
  parent_id: string;
  kind: ConsentKind;
  version: string;
  text_snapshot: string;
  granted: boolean;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

/** Bez PIN sloupců — klient je nemá v grantu a nikdy je nedostane. */
export type ChildRow = {
  id: string;
  parent_id: string;
  nick: string;
  birth_year: number;
  avatar: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  summary: string | null;
  order_index: number;
  legacy_task_id: string | null;
  estimated_minutes: number | null;
  video_url: string | null;
  body: Record<string, unknown>;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type ProgressRow = {
  id: number;
  child_id: string;
  lesson_id: string;
  status: ProgressStatus;
  started_at: string;
  completed_at: string | null;
  duration_s: number | null;
  hints_used: number;
  updated_at: string;
}

export type ProjectRow = {
  id: string;
  child_id: string;
  lesson_id: string | null;
  kind: ProjectKind;
  title: string | null;
  data: Record<string, unknown>;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export type LearningEventRow = {
  id: number;
  parent_id: string | null;
  child_id: string | null;
  anon_id: string | null;
  type: string;
  props: Record<string, unknown>;
  created_at: string;
}

export type CityWaitlistRow = {
  id: number;
  parent_id: string | null;
  email: string | null;
  city: string;
  region_code: string | null;
  created_at: string;
}

/* POZOR: Row musí být `type`, ne `interface`. Interface nemá implicitní
   index signature, takže by neprošel constraintem Record<string, unknown>
   uvnitř GenericSchema — a celé Database["public"] by supabase-js vyhodnotil
   jako `never`. Projeví se to jako "not assignable to parameter of type never"
   u každého .insert(), což na skutečnou příčinu vůbec neukazuje. */
type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      regions: Table<RegionRow>;
      parents: Table<ParentRow>;
      consents: Table<ConsentRow>;
      children: Table<
        ChildRow,
        Pick<ChildRow, "parent_id" | "nick" | "birth_year"> & { avatar?: string }
      >;
      courses: Table<CourseRow>;
      lessons: Table<LessonRow>;
      progress: Table<
        ProgressRow,
        Pick<ProgressRow, "child_id" | "lesson_id"> & Partial<ProgressRow>
      >;
      projects: Table<ProjectRow, Pick<ProjectRow, "child_id"> & Partial<ProjectRow>>;
      learning_events: Table<
        LearningEventRow,
        Pick<LearningEventRow, "type"> & Partial<LearningEventRow>
      >;
      city_waitlist: Table<CityWaitlistRow, Pick<CityWaitlistRow, "city"> & Partial<CityWaitlistRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      record_consent: {
        Args: {
          p_kind: ConsentKind;
          p_version: string;
          p_text_snapshot: string;
          p_granted: boolean;
          p_ip?: string | null;
          p_user_agent?: string | null;
        };
        Returns: number;
      };
      has_consent: {
        Args: { p_parent: string; p_kind: ConsentKind };
        Returns: boolean;
      };
      child_has_pin: {
        Args: { p_child: string };
        Returns: boolean;
      };
      owns_child: {
        Args: { target: string };
        Returns: boolean;
      };
      /* Jen pro servisní roli — klient na ni nemá grant. */
      bump_rate_limit: {
        Args: { p_bucket: string; p_window_ms: number };
        Returns: number;
      };
    };
    Enums: {
      consent_kind: ConsentKind;
      progress_status: ProgressStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
