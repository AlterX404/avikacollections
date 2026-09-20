-- Custom SQL migration file, put your code below! --
CREATE TRIGGER order_stock_guard BEFORE INSERT ON orders BEGIN
 SELECT CASE WHEN NEW.demo != 1 THEN RAISE(ABORT,'live_order_disabled') END;
 SELECT CASE WHEN json_array_length(NEW.items)=0 OR EXISTS(SELECT 1 FROM json_each(NEW.items) j LEFT JOIN variants v ON v.id=json_extract(j.value,'$.variantId') LEFT JOIN products p ON p.id=v.product_id WHERE v.id IS NULL OR p.status!='published' OR p.demo!=1 OR v.stock<json_extract(j.value,'$.quantity') OR json_extract(j.value,'$.quantity')<1 OR v.price!=json_extract(j.value,'$.price')) THEN RAISE(ABORT,'stock_or_price_changed') END;
 SELECT CASE WHEN NEW.code IS NOT NULL AND NOT EXISTS(SELECT 1 FROM discounts WHERE code=NEW.code AND active=1 AND used<usage_limit AND expires>NEW.created AND minimum<=NEW.subtotal AND NEW.discount=CAST(NEW.subtotal*percent/100 AS INTEGER)) THEN RAISE(ABORT,'discount_changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER order_reserve AFTER INSERT ON orders BEGIN
 UPDATE variants SET stock=stock-(SELECT SUM(json_extract(value,'$.quantity')) FROM json_each(NEW.items) WHERE json_extract(value,'$.variantId')=variants.id) WHERE id IN(SELECT json_extract(value,'$.variantId') FROM json_each(NEW.items));
 UPDATE discounts SET used=used+1 WHERE code=NEW.code;
END;
--> statement-breakpoint
CREATE TRIGGER nonnegative_stock BEFORE UPDATE OF stock ON variants WHEN NEW.stock<0 BEGIN SELECT RAISE(ABORT,'stock_negative'); END;
--> statement-breakpoint
CREATE TRIGGER order_release AFTER UPDATE OF payment,refund ON orders WHEN (OLD.payment='pending' AND NEW.payment IN('failed','canceled')) OR (OLD.refund!='refunded' AND NEW.refund='refunded' AND OLD.payment='paid') BEGIN
 UPDATE variants SET stock=stock+(SELECT SUM(json_extract(value,'$.quantity')) FROM json_each(NEW.items) WHERE json_extract(value,'$.variantId')=variants.id) WHERE id IN(SELECT json_extract(value,'$.variantId') FROM json_each(NEW.items));
END;
--> statement-breakpoint
CREATE TRIGGER payment_transition BEFORE INSERT ON payment_events BEGIN
 SELECT CASE WHEN NEW.status NOT IN('paid','pending','failed','canceled') OR NOT EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND demo=1 AND (payment='pending' OR payment=NEW.status)) THEN RAISE(ABORT,'payment_state_conflict') END;
END;
--> statement-breakpoint
CREATE UNIQUE INDEX requests_one_open ON requests(order_id,type) WHERE status!='rejected';
--> statement-breakpoint
CREATE UNIQUE INDEX orders_idempotency ON orders(owner,request_key);
