-- Pin search_path on the remaining SECURITY DEFINER / trigger functions so a
-- role-mutable search_path cannot shadow objects they reference. Clears the
-- function_search_path_mutable advisor warnings on these.
alter function public.accept_investor_application(uuid)   set search_path = public;
alter function public.reject_investor_application(uuid)    set search_path = public;
alter function public.set_application_under_review(uuid)   set search_path = public;
alter function public.set_updated_at()                     set search_path = public;
