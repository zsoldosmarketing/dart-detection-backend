create table if not exists public.dart_detection_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  feedback_type text not null check (feedback_type in ('accepted', 'corrected', 'rejected', 'retry')),
  predicted_target text,
  resolved_target text,
  model_confidence numeric(5,4),
  calibration_confidence numeric(5,4),
  calibration_method text,
  scoring_method text,
  frame_change_quality text,
  device_kind text,
  constraint valid_model_confidence check (model_confidence is null or (model_confidence >= 0 and model_confidence <= 1)),
  constraint valid_calibration_confidence check (calibration_confidence is null or (calibration_confidence >= 0 and calibration_confidence <= 1))
);

create index if not exists dart_detection_feedback_user_created_idx
  on public.dart_detection_feedback (user_id, created_at desc);

create index if not exists dart_detection_feedback_outcome_idx
  on public.dart_detection_feedback (feedback_type, created_at desc);

alter table public.dart_detection_feedback enable row level security;

create policy "Users can insert their own detection feedback"
  on public.dart_detection_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own detection feedback"
  on public.dart_detection_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);
