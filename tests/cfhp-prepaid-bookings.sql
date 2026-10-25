begin;
do $$
declare actor uuid; p jsonb; b jsonb; blocked boolean; bid uuid:='7519a499-8b4a-4efe-96e2-16ab73b219ab'; sid uuid:='4b2ef049-dd1d-45ab-875c-d0f06b7d5498'; tx uuid; n integer;
begin
 select id into actor from auth.users where email='netsgcwork@gmail.com';
 if actor is null then raise exception 'Test admin missing'; end if;
 p:=jsonb_build_object('id',bid,'customer_email','payment-test@example.invalid','guest_token_hash',repeat('a',64),'service_name','Payment gating verification','duration_minutes',40,'amount_zar',250,'customer_name','Test Payment','phone','+27000000001','starts_at','2031-01-01T08:00:00Z','ends_at','2031-01-01T08:40:00Z','payment_method','eft');
 b:=public.cfhp_reserve(p);
 if b->>'status'<>'awaiting_payment' or b->>'event_id' is not null then raise exception 'Unpaid booking was accepted'; end if;
 blocked:=false;
 begin perform public.cfhp_record_payment(bid,null,'eft',250,'BANK TEST',true); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Unprivileged payment confirmation allowed'; end if;
 blocked:=false;
 begin perform public.cfhp_record_payment(bid,actor,'eft',1,'BANK TEST',true); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Incorrect payment amount accepted'; end if;
 blocked:=false;
 begin update public.cfhp_bookings set status='confirmed' where id=bid; exception when check_violation then blocked:=true; end;
 if not blocked then raise exception 'Payment gate bypassed'; end if;
 b:=public.cfhp_record_payment(bid,actor,'eft',250,'BANK TEST RECEIVED',true);
 if b->>'status'<>'pending_calendar' or b->>'payment_status'<>'paid' or b->>'accepted_at' is null then raise exception 'Admin confirmation failed'; end if;
 p:=p||jsonb_build_object('id',sid,'payment_method','stitch','starts_at','2031-01-01T10:00:00Z','ends_at','2031-01-01T10:40:00Z');
 perform public.cfhp_reserve(p);
 blocked:=false;
 begin perform public.cfhp_record_payment(sid,actor,'stitch',250,'UNVERIFIED STITCH',true); exception when others then blocked:=true; end;
 if not blocked then raise exception 'Unverified Stitch payment accepted'; end if;
 insert into public.sgc_stitch_transactions(merchant_reference,stitch_payment_id,product_id,product_name,amount_zar,billing,status)
 values('C-'||sid,'cfhp-test-link','cfhp-booking:'||sid,'CFHP verification',250,'once','pending') returning id into tx;
 update public.sgc_stitch_transactions set status='paid',paid_at=now() where id=tx;
 select to_jsonb(x) into b from public.cfhp_bookings x where id=sid;
 if b->>'status'<>'awaiting_acceptance' or b->>'payment_status'<>'paid' or b->>'accepted_at' is not null then raise exception 'Stitch payment bypassed admin acceptance'; end if;
 b:=public.cfhp_record_payment(sid,actor,'stitch',250,'VERIFIED STITCH ACCEPTED',true);
 update public.sgc_stitch_transactions set status='paid' where id=tx;
 select count(*) into n from public.cfhp_payment_audit where booking_id=sid and action='stitch_payment_verified';
 if n<>1 then raise exception 'Duplicate webhook reapplied payment'; end if;
 if not exists(select 1 from public.cfhp_bookings where id=sid and status='pending_calendar') then raise exception 'Duplicate webhook reset acceptance'; end if;
end $$;
select 'PASS: unpaid gate, EFT verification, amount checks, verified Stitch awaiting manual acceptance, retry idempotency' as result;
rollback;