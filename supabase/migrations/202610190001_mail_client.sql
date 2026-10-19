-- Only the protected Edge Function writes delivery state. Existing admin SELECT policy remains.
alter table public.mail_outbox drop constraint mail_outbox_status_check;
alter table public.mail_outbox add constraint mail_outbox_status_check check (status in ('sending','sent','uncertain','failed'));
alter table public.mail_outbox add column transport text not null default 'legacy';
alter table public.mail_outbox add column sent_copy_saved boolean not null default false;
-- Temporary RFC822 copy for retrying IMAP APPEND without sending SMTP again. Cleared after synchronization.
alter table public.mail_outbox add column source text check (source is null or length(source)<200000);
insert into public.admin_backend_versions(version) values ('202610190001');
