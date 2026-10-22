begin;
do $test$
declare pub sgc_private.website_publications; s text; k1 uuid:=gen_random_uuid();k2 uuid:=gen_random_uuid();k3 uuid:=gen_random_uuid();k4 uuid:=gen_random_uuid();mk uuid:=gen_random_uuid(); result jsonb; payload jsonb; rejected boolean:=false;
begin
 select * into pub from sgc_private.website_publications where unpublished_at is null and sgc_private.website_subscription_active(user_id) limit 1 for update;
 if pub.website_id is null then raise exception 'No eligible fixture';end if;s:=pub.slug;
 update sgc_private.website_publications set snapshot=jsonb_set(snapshot,'{preferences,activeStudio}','"fitness"') where website_id=pub.website_id;
 payload:=jsonb_build_object('title','QA class','classId','qa-capacity','date','2100-01-04','time','12:00','capacity',1,'cancelHours',12,'total',120,'number','QA-1');
 result:=public.sgc_fitness_write(s,k1,'booking','{}',payload);
 begin perform public.sgc_fitness_write(s,k2,'booking','{}',payload);exception when others then if sqlerrm like '%class is full%' then rejected:=true;else raise;end if;end;
 if not rejected then raise exception 'Capacity was exceeded';end if;
 result:=public.sgc_fitness_write(s,k1,'booking','{}','{}','cancel');if result->>'status'<>'Cancelled' then raise exception 'Cancel failed';end if;
 result:=public.sgc_fitness_write(s,mk,'membership','{}',jsonb_build_object('title','QA plan','credits',1,'unlimited',false,'endsAt','2100-02-01T00:00:00Z','total',399,'number','QA-M'));
 update public.sgc_fitness_records set status='Active' where website_id=pub.website_id and request_key=mk;
 result:=public.sgc_fitness_write(s,k3,'booking','{}',payload,'submit',mk);if (result->'data'->>'total')::numeric<>0 then raise exception 'Membership did not cover booking';end if;
 payload:=payload||jsonb_build_object('time','13:00');rejected:=false;
 begin perform public.sgc_fitness_write(s,k4,'booking','{}',payload,'submit',mk);exception when others then if sqlerrm like '%No class credits%' then rejected:=true;else raise;end if;end;
 if not rejected then raise exception 'Credit was reused';end if;
 perform public.sgc_fitness_write(s,k3,'booking','{}','{}','cancel');
 result:=public.sgc_fitness_write(s,k4,'booking','{}',payload,'submit',mk);
 payload:=payload||jsonb_build_object('time','14:00');result:=public.sgc_fitness_write(s,k4,'booking','{}',payload,'reschedule',mk);
 if result->'data'->>'time'<>'14:00' then raise exception 'Reschedule failed';end if;
 rejected:=false;
 begin perform public.sgc_fitness_write(s,gen_random_uuid(),'order','{}',jsonb_build_object('lines',jsonb_build_array(jsonb_build_object('productId','qa-stock','name','QA product','quantity',3,'stock',5,'trackStock',true),jsonb_build_object('productId','qa-stock','name','QA product','quantity',3,'stock',5,'trackStock',true))));exception when others then if sqlerrm like '%not enough stock%' then rejected:=true;else raise;end if;end;
 if not rejected then raise exception 'Combined variants oversold stock';end if;
end;$test$;
rollback;
select 'PASS: capacity, cancellation, membership credits, credit restoration, reschedule and combined stock; all fixture changes rolled back' as result;
