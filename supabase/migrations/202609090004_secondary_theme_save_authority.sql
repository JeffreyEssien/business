-- The wrapper must be able to persist the added token after the authoritative
-- save has performed its tenant-membership check and all other validation.
alter function public.save_site_draft_with_secondary(
 uuid,text,text,text,text,text,text,text,text,text,text,text,boolean,text,text,text,text,text,text,boolean,text,jsonb,
 text,text,text,text,bigint,text,text,integer,integer,text,text,text,text,bigint,text,text,integer,integer
) security definer;
