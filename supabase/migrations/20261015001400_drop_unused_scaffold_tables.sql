-- Remove scaffold tables for modules that have no application or RPC usage.
-- This permanently removes any data stored in these tables.
drop table if exists public.volunteer_assignments cascade;
drop table if exists public.volunteer_applications cascade;
drop table if exists public.event_volunteer_openings cascade;
drop table if exists public.committee_assignments cascade;
drop table if exists public.committee_designations cascade;
drop table if exists public.recruitment_responses cascade;
drop table if exists public.recruitment_forms cascade;
drop table if exists public.membership_applications cascade;
