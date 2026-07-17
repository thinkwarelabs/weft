-- Columns required by the GST-included item pricing feature:
-- entered_unit_price keeps the price as typed; unit_price stores the
-- back-calculated pre-tax price when gst_included is true.
alter table invoice_items add column if not exists gst_included boolean not null default true;
alter table invoice_items add column if not exists entered_unit_price numeric;
